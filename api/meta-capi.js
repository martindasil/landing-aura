// Vercel Serverless Function — Meta Conversions API (CAPI).
//
// Recibe eventos del frontend (PageView, Lead) y los reenvía a la API de
// Meta desde el servidor, con el access token — que así nunca llega al
// navegador (a diferencia del Pixel Id, que es público y ya vive en
// index.html). El único secreto real es META_CAPI_ACCESS_TOKEN, que se
// configura como variable de entorno en Vercel (sin prefijo VITE_, para
// que no se empaquete en el JS del cliente).
//
// No bloquea nunca al que llama por fallos de configuración: si falta el
// token o Meta rechaza el evento, se responde igualmente sin lanzar un
// error que rompa el flujo del usuario en la web. Sí rechaza (403/429) por
// origen no permitido o límite de peticiones — eso es intencional.

import crypto from "node:crypto";
import { checkRateLimit } from "./_lib/rateLimit.js";

const PIXEL_ID = "1223359003262932";
const GRAPH_API_VERSION = "v21.0";

// Dominio canónico + dominios de preview de Vercel de este proyecto (URL
// distinta en cada deploy de rama/PR, de ahí el patrón en vez de una lista
// fija). El dominio raíz landingaura.com redirige con 308 a www antes de
// que corra ningún JS, así que el navegador nunca manda ese origen aquí.
const ORIGEN_EXACTO_PERMITIDO = "https://www.landingaura.com";
const PATRON_PREVIEW_VERCEL = /^https:\/\/landing-aura-[a-z0-9-]+\.vercel\.app$/;

function esOrigenPermitido(origin) {
  if (!origin) return false;
  return origin === ORIGEN_EXACTO_PERMITIDO || PATRON_PREVIEW_VERCEL.test(origin);
}

function aplicarCabecerasCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // El origen permitido depende de la petición: sin este header, un proxy
  // o CDN podría cachear la respuesta de un origen y servirla a otro.
  res.setHeader("Vary", "Origin");
}

function sha256(valor) {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

// Meta exige el teléfono en formato E.164 sin el "+": código de país +
// número, solo dígitos. Si el usuario no escribió el prefijo de España
// (caso normal en el formulario, que solo pide "600 000 000"), se lo
// añadimos antes de hashear.
function normalizarTelefono(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 9) return `34${digitos}`;
  return digitos;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const origenValido = esOrigenPermitido(origin);

  if (req.method === "OPTIONS") {
    if (origenValido) {
      aplicarCabecerasCors(res, origin);
      res.status(204).end();
    } else {
      res.status(403).end();
    }
    return;
  }

  if (!origenValido) {
    res.status(403).json({ error: "Origen no permitido" });
    return;
  }
  aplicarCabecerasCors(res, origin);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const { limited } = await checkRateLimit(ip);
  if (limited) {
    res.status(429).json({ error: "Demasiadas peticiones, inténtalo más tarde" });
    return;
  }

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) {
    res.status(200).json({ skipped: true, reason: "META_CAPI_ACCESS_TOKEN no configurado" });
    return;
  }

  const body = req.body || {};
  const { event_name, event_id, event_source_url, email, telefono, fbp, fbc } = body;
  if (!event_name) {
    res.status(400).json({ error: "Falta event_name" });
    return;
  }

  try {
    const userAgent = req.headers["user-agent"] || "";

    const userData = {};
    if (ip) userData.client_ip_address = ip;
    if (userAgent) userData.client_user_agent = userAgent;
    if (email) userData.em = [sha256(String(email).trim().toLowerCase())];
    const telefonoNormalizado = normalizarTelefono(telefono);
    if (telefonoNormalizado) userData.ph = [sha256(telefonoNormalizado)];
    // fbp/fbc van en texto plano — no son identificadores personales, son
    // los IDs de atribución del propio Pixel/anuncio. Solo se hashean em/ph.
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || undefined,
          event_source_url: event_source_url || undefined,
          action_source: "website",
          user_data: userData,
        },
      ],
    };

    // Va en la raíz del body, hermano de "data" — NUNCA dentro del evento.
    // Solo se incluye si la variable existe y no está vacía; para
    // desactivar el modo test basta con borrar la variable de entorno,
    // sin tocar código. Los eventos con test_event_code no cuentan para
    // optimización de Meta.
    const testEventCode = (process.env.META_TEST_EVENT_CODE || "").trim();
    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      console.error("Meta CAPI rechazó el evento:", data);
      res.status(502).json({ error: "Meta CAPI rechazó el evento", detail: data });
      return;
    }

    res.status(200).json({ ok: true, meta: data });
  } catch (e) {
    console.error("Error enviando evento a Meta CAPI:", e);
    res.status(500).json({ error: "Error interno" });
  }
}
