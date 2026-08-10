// Vercel Serverless Function — proxy del webhook de análisis de piel de n8n.
//
// Antes, el navegador llamaba directo a la URL de n8n (hardcodeada en
// src/App.jsx, visible en el bundle público). Cualquiera podía dispararla
// desde fuera del navegador — CORS no lo impide, solo restringe qué puede
// leer la respuesta un navegador, no quién puede hacer la petición. Cada
// llamada cuesta ~26s de generación con Claude en n8n, pagados por
// nosotros, así que esa ruta era un vector de abuso de coste directo.
//
// Esta función queda en medio: valida origen + límite de peticiones antes
// de reenviar, y añade una cabecera secreta que n8n puede exigir para
// aceptar la llamada — así que aunque alguien copie la URL de esta función
// (que sigue siendo pública, es la que ahora ve el navegador), no tiene la
// cabecera para que n8n la acepte, y de todas formas chocaría con el
// límite por IP antes de llegar tan lejos.
//
// maxDuration: 60 — el análisis real tarda ~26s; documentado explícito en
// vez de confiar en el default de la cuenta (verificado en la doc actual
// de Vercel: con Fluid Compute, Pro/Enterprise ya trae 300s por defecto y
// hasta 800s de máximo, pero se fija aquí igualmente para no depender de
// un valor implícito que podría no ser el mismo en otra cuenta/plan).
export const config = {
  maxDuration: 60,
};

import { checkRateLimit } from "./_lib/rateLimit.js";

// Mismo origen canónico + patrón de previews que api/meta-capi.js (ver
// comentario allí sobre por qué el dominio raíz no aparece en la lista).
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
  res.setHeader("Vary", "Origin");
}

// Timeout propio al llamar a n8n, por debajo de maxDuration: si dejáramos
// que fuera Vercel quien mate la invocación a los 60s, el navegador
// recibiría un 504 opaco sin cuerpo JSON en vez del error controlado que
// espera (mismo formato que "es_valido: false").
const N8N_TIMEOUT_MS = 55000;

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
  // 5/hora: un lead legítimo hace uno o dos análisis, así que sobra margen.
  // Se mantiene laxo a propósito porque el tráfico llega de anuncios en
  // móvil, donde muchos usuarios comparten IP por CGNAT — un límite más
  // estricto bloquearía leads reales, no solo abuso.
  const { limited } = await checkRateLimit(ip, { prefix: "analisis", max: 5, window: "1 h" });
  if (limited) {
    res.status(429).json({ error: "Demasiadas peticiones, inténtalo más tarde" });
    return;
  }

  const webhookUrl = process.env.N8N_ANALISIS_WEBHOOK_URL;
  const secreto = process.env.N8N_ANALISIS_SECRET;
  if (!webhookUrl) {
    res.status(500).json({ error: "Análisis no disponible" });
    return;
  }

  const body = req.body || {};
  if (!body.imagen) {
    res.status(400).json({ error: "Falta imagen" });
    return;
  }

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), N8N_TIMEOUT_MS);
  try {
    const headers = { "Content-Type": "application/json" };
    if (secreto) headers["X-Landing-Secret"] = secreto;

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: timeoutCtrl.signal,
    });

    const data = await n8nRes.json().catch(() => null);
    if (data === null) {
      res.status(502).json({ error: "Respuesta inválida del análisis" });
      return;
    }
    // Se reenvía tal cual — mismo status, mismo cuerpo — el frontend ya
    // sabe interpretar `es_valido`/`motivo` de este JSON.
    res.status(n8nRes.status).json(data);
  } catch (e) {
    const esTimeout = e.name === "AbortError";
    console.error(esTimeout ? "Timeout llamando al webhook de análisis:" : "Error llamando al webhook de análisis:", e);
    res.status(esTimeout ? 504 : 502).json({ error: "El análisis no se ha podido completar" });
  } finally {
    clearTimeout(timeoutId);
  }
}
