import { useState, useRef, useEffect } from "react";
import config from "./configs/activo.js";

// ─────────────────────────────────────────────────────────────
// VERSIÓN PRODUCCIÓN — Landing interactiva multi-cliente
// La llamada a la IA pasa por tu webhook de n8n (la clave API
// vive en n8n, nunca en el navegador).
//
// Todo el contenido de negocio (marca, textos, criterios de
// análisis, bloques de respuesta, datos de negocio) vive en
// src/configs/*.js. Este componente no debe contener texto ni
// lógica específica de ningún cliente — para cambiar de cliente,
// edita únicamente src/configs/activo.js.
//
// CONFIGURA ESTAS DOS URLS ANTES DE DESPLEGAR:
// ─────────────────────────────────────────────────────────────

// URL de PRODUCCIÓN del webhook de análisis (workflow "Landing IA — Análisis de piel")
const WEBHOOK_URL = "https://random-n8n.9zi4ji.easypanel.host/webhook/analisis-piel";

// Opcional: webhook para notificar el lead a la clínica (WhatsApp/email/Airtable).
// Si lo dejas vacío (""), el formulario funciona pero no envía nada.
const LEAD_WEBHOOK_URL = "https://random-n8n.9zi4ji.easypanel.host/webhook/landing-leads";

const { marca, analisis, respuesta } = config;
const { colores, hero, textos_upload: t, footer } = marca;

// Convierte "texto *destacado*" en JSX con <em> en la parte marcada
function renderEmphasis(text) {
  const parts = text.split(/\*(.+?)\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

const scoreTone = (n) => (n >= 75 ? "var(--sage)" : n >= 55 ? "var(--amber)" : "var(--clay)");

// ── Renderizadores de bloque (result.bloques[].tipo) ──────────
// Catálogo fijo definido en el contrato de respuesta de la IA.
// Cualquier tipo no reconocido se ignora (defensa ante payloads manipulados).

function BloquePuntuaciones({ items, barsOn }) {
  if (!items?.length) return null;
  return (
    <div className="card">
      <div className="card-label">Puntuación por zonas</div>
      {items.map((z, i) => (
        <div className="zone" key={i}>
          <div className="zone-top">
            <span className="zone-name">{z.nombre}</span>
            <span className="zone-score" style={{ color: scoreTone(z.puntuacion) }}>
              {z.puntuacion}
            </span>
          </div>
          <div className="bar">
            <div
              style={{
                width: barsOn ? `${z.puntuacion}%` : 0,
                background: scoreTone(z.puntuacion),
                transitionDelay: `${i * 90}ms`,
              }}
            />
          </div>
          <div className="zone-obs">{z.observacion}</div>
        </div>
      ))}
    </div>
  );
}

function BloqueFortalezas({ items }) {
  if (!items?.length) return null;
  return (
    <div className="card">
      <div className="card-label">Lo que ya funciona bien</div>
      <div className="strengths">
        {items.map((f, i) => (
          <div className="strength" key={i}>
            <span className="dot">✦</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BloqueRecomendaciones({ items }) {
  if (!items?.length) return null;
  return (
    <div className="card">
      <div className="card-label">Recomendaciones</div>
      {items.map((r, i) => (
        <div className="treat" key={i}>
          <div className="treat-top">
            <span className="treat-name">{r.titulo}</span>
          </div>
          {r.zona && <div className="treat-zone">{r.zona}</div>}
          {r.beneficio && <div className="treat-benefit"><strong>{r.beneficio}</strong></div>}
          {r.detalle && <div className="treat-benefit">{r.detalle}</div>}
        </div>
      ))}
    </div>
  );
}

function BloqueChecklist({ items }) {
  if (!items?.length) return null;
  const tone = (estado) =>
    estado === "ok" ? "var(--sage)" : estado === "aviso" ? "var(--amber)" : "var(--clay)";
  const icon = (estado) => (estado === "ok" ? "✓" : estado === "aviso" ? "!" : "✕");
  return (
    <div className="card">
      <div className="card-label">Checklist</div>
      <div className="strengths">
        {items.map((c, i) => (
          <div className="strength" key={i}>
            <span className="dot" style={{ color: tone(c.estado) }}>
              {icon(c.estado)}
            </span>
            <span>
              <strong>{c.nombre}</strong>
              {c.observacion ? ` — ${c.observacion}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BloquePropuesta({ partidas }) {
  if (!partidas?.length) return null;
  return (
    <div className="card">
      <div className="card-label">Propuesta</div>
      {partidas.map((p, i) => (
        <div className="treat" key={i}>
          <div className="treat-top">
            <span className="treat-name">{p.nombre}</span>
          </div>
          <div className="treat-benefit">{p.descripcion}</div>
        </div>
      ))}
    </div>
  );
}

function BloqueHorquillaPrecio({ minimo, maximo, moneda, nota }) {
  if (minimo == null || maximo == null) return null;
  return (
    <div className="card">
      <div className="card-label">Rango de precio orientativo</div>
      <div className="price-range">
        {minimo}–{maximo} {moneda || ""}
      </div>
      {nota && <div className="zone-obs" style={{ textAlign: "center" }}>{nota}</div>}
      <div className="price-disclaimer">
        Precio orientativo. El presupuesto exacto se confirma tras una visita.
      </div>
    </div>
  );
}

function BloqueImagenDespues({ url, etiqueta_legal }) {
  // Fase 2 (pendiente): hoy en día n8n no genera esta imagen todavía.
  // Si en el futuro el webhook empieza a enviar este bloque con una
  // url, se pintará automáticamente sin más cambios en el componente.
  if (!url) return null;
  return (
    <div className="card">
      <div className="card-label">Simulación</div>
      <div className="sim-frame">
        <img src={url} alt="Simulación del resultado" />
        {/* Etiqueta legal siempre visible superpuesta a la imagen, nunca oculta */}
        {etiqueta_legal && <div className="sim-tag">{etiqueta_legal}</div>}
      </div>
    </div>
  );
}

function renderBloque(bloque, i, barsOn) {
  switch (bloque.tipo) {
    case "puntuaciones":
      return <BloquePuntuaciones key={i} items={bloque.items} barsOn={barsOn} />;
    case "fortalezas":
      return <BloqueFortalezas key={i} items={bloque.items} />;
    case "recomendaciones":
      return <BloqueRecomendaciones key={i} items={bloque.items} />;
    case "checklist":
      return <BloqueChecklist key={i} items={bloque.items} />;
    case "propuesta":
      return <BloquePropuesta key={i} partidas={bloque.partidas} />;
    case "horquilla_precio":
      return (
        <BloqueHorquillaPrecio
          key={i}
          minimo={bloque.minimo}
          maximo={bloque.maximo}
          moneda={bloque.moneda}
          nota={bloque.nota}
        />
      );
    case "imagen_despues":
      return <BloqueImagenDespues key={i} url={bloque.url} etiqueta_legal={bloque.etiqueta_legal} />;
    default:
      return null;
  }
}

export default function LandingAura() {
  const [view, setView] = useState("upload"); // upload | analyzing | report | form | done
  const [photo, setPhoto] = useState(null);
  const [consent, setConsent] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState({ nombre: "", telefono: "", franja: "Mañanas" });
  const [barsOn, setBarsOn] = useState(false);
  const fileRef = useRef(null);
  const imgB64 = useRef(null);

  const mensajesCarga = analisis.mensajes_carga?.length
    ? analisis.mensajes_carga
    : ["Analizando…"];

  useEffect(() => {
    if (view !== "analyzing") return;
    const tick = setInterval(() => setMsgIdx((i) => (i + 1) % mensajesCarga.length), 1900);
    return () => clearInterval(tick);
  }, [view]);

  useEffect(() => {
    if (view === "report") {
      setBarsOn(false);
      const tmr = setTimeout(() => setBarsOn(true), 150);
      return () => clearTimeout(tmr);
    }
  }, [view]);

  // Redimensiona a máx 1024px y devuelve dataURL jpeg (menos coste y latencia)
  const prepareImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const r = Math.min(MAX / width, MAX / height);
            width = Math.round(width * r);
            height = Math.round(height * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("No se pudo leer la imagen"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const onFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    try {
      const dataUrl = await prepareImage(file);
      setPhoto(dataUrl);
      imgB64.current = dataUrl.split(",")[1];
    } catch (e) {
      setError("No se pudo procesar la imagen. Prueba con otra foto.");
    }
  };

  const analyze = async () => {
    if (!imgB64.current || !consent) return;
    setView("analyzing");
    setMsgIdx(0);
    setError(null);
    try {
      const body = {
        imagen: imgB64.current,
        analisis: analisis,
        bloques_activos: respuesta.bloques,
      };
      // Solo se incluye el campo si el cliente activo tiene imagen_despues
      // configurada — el backend decide qué hacer según su presencia, no
      // según que venga a null/undefined.
      if (respuesta.imagen_despues) {
        body.imagen_despues = {
          prompt_edicion: respuesta.imagen_despues.prompt_edicion,
          etiqueta_legal: respuesta.imagen_despues.etiqueta_legal,
        };
      }
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // n8n construye el prompt a partir de `analisis` y valida que
        // `bloques_activos` solo contenga tipos del catálogo fijo
        // (ver n8n-PROMPT-BUILDER.md).
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Webhook respondió ${response.status}`);
      const parsed = await response.json();
      if (!parsed.es_valido) {
        setError(parsed.motivo || analisis.rechazo);
        setView("upload");
        return;
      }
      setResult(parsed);
      setView("report");
    } catch (e) {
      setError("El análisis no se ha podido completar. Inténtalo de nuevo en unos segundos.");
      setView("upload");
    }
  };

  const submitLead = async () => {
    const campos = respuesta.cta.campos;
    if (campos.includes("nombre") && !lead.nombre.trim()) return;
    if (campos.includes("telefono") && lead.telefono.trim().length < 9) return;
    if (sending) return;
    setSending(true);
    if (LEAD_WEBHOOK_URL) {
      try {
        await fetch(LEAD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: lead.nombre.trim(),
            telefono: lead.telefono.trim(),
            franja: lead.franja,
            resumen: result?.resumen || "",
            bloques: result?.bloques || [],
            // Foto original subida por el cliente ("antes"), en base64 sin
            // el prefijo data:image/...;base64,. n8n la adjunta como imagen.
            foto_antes: imgB64.current || "",
            origen: `landing-${marca.nombre.toLowerCase().replace(/\s+/g, "-")}`,
            fecha: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // No bloqueamos al usuario si la notificación falla; el error queda en consola
        console.error("Error notificando el lead:", e);
      }
    }
    setSending(false);
    setView("done");
  };

  const reset = () => {
    setView("upload");
    setPhoto(null);
    imgB64.current = null;
    setResult(null);
    setConsent(false);
    setError(null);
    setLead({ nombre: "", telefono: "", franja: "Mañanas" });
  };

  const campos = respuesta.cta.campos;
  const formValido =
    (!campos.includes("nombre") || lead.nombre.trim()) &&
    (!campos.includes("telefono") || lead.telefono.trim().length >= 9);

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

        :root {
          --bg: ${colores.bg};
          --card: ${colores.card};
          --ink: ${colores.ink};
          --ink-soft: ${colores.inkSoft};
          --sage: ${colores.sage};
          --sage-deep: ${colores.sageDeep};
          --sage-soft: ${colores.sageSoft};
          --blush: ${colores.blush};
          --amber: ${colores.amber};
          --clay: ${colores.clay};
          --line: ${colores.line};
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--ink);
          font-family: 'Inter', -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .wrap { max-width: 680px; margin: 0 auto; padding: 0 20px 64px; }

        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 0; }
        .brand { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; letter-spacing: 0.02em; color: var(--sage-deep); }

        .hero { padding: 52px 0 8px; text-align: center; }
        .eyebrow {
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--sage); margin-bottom: 18px; font-weight: 600;
        }
        h1 {
          font-family: 'Fraunces', serif; font-weight: 500;
          font-size: clamp(30px, 6vw, 44px); line-height: 1.12;
          letter-spacing: -0.01em; margin-bottom: 16px;
        }
        h1 em { font-style: italic; color: var(--sage); }
        .sub { color: var(--ink-soft); font-size: 16px; line-height: 1.6; max-width: 460px; margin: 0 auto; }

        .uploader {
          margin: 36px auto 0; background: var(--card);
          border: 1px solid var(--line); border-radius: 20px;
          padding: 28px; box-shadow: 0 2px 24px rgba(34,49,43,0.05);
        }
        .dropzone {
          border: 1.5px dashed #CBBFAE; border-radius: 14px;
          padding: 40px 20px; text-align: center; cursor: pointer;
          transition: border-color .2s, background .2s;
        }
        .dropzone:hover { border-color: var(--sage); background: var(--sage-soft); }
        .dz-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: var(--sage-soft); color: var(--sage);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px; font-size: 22px;
        }
        .dz-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
        .dz-hint { font-size: 13px; color: var(--ink-soft); }
        .preview { display: flex; gap: 16px; align-items: center; }
        .preview img {
          width: 88px; height: 88px; object-fit: cover; border-radius: 12px;
          border: 1px solid var(--line);
        }
        .preview .meta { flex: 1; text-align: left; }
        .preview .meta b { display: block; font-size: 14px; margin-bottom: 2px; }
        .preview .meta span { font-size: 13px; color: var(--ink-soft); }
        .link-btn {
          background: none; border: none; color: var(--sage); font-size: 13px;
          font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0;
          font-family: inherit;
        }
        .consent { display: flex; gap: 10px; align-items: flex-start; margin-top: 18px; text-align: left; }
        .consent input { margin-top: 3px; accent-color: var(--sage); width: 16px; height: 16px; cursor: pointer; }
        .consent label { font-size: 12.5px; color: var(--ink-soft); line-height: 1.5; cursor: pointer; }

        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--sage); color: #FDFBF8; border: none;
          font-family: inherit; font-size: 15px; font-weight: 600;
          padding: 15px 32px; border-radius: 100px; cursor: pointer;
          transition: background .2s, transform .1s; width: 100%;
          margin-top: 18px;
        }
        .btn:hover:not(:disabled) { background: var(--sage-deep); }
        .btn:active:not(:disabled) { transform: scale(0.99); }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn.ghost { background: transparent; color: var(--sage); border: 1.5px solid var(--sage); }

        .error {
          margin-top: 16px; background: #FBF1EC; border: 1px solid #EBCDBB;
          color: #8A4A33; font-size: 13.5px; padding: 12px 16px; border-radius: 12px;
          line-height: 1.5;
        }
        .privacy-note { text-align: center; font-size: 12px; color: var(--ink-soft); margin-top: 14px; line-height: 1.5; }

        .scan-stage { text-align: center; padding: 48px 0 0; }
        .scan-frame {
          position: relative; width: 240px; height: 300px; margin: 0 auto 28px;
          border-radius: 18px; overflow: hidden; border: 1px solid var(--line);
          box-shadow: 0 8px 40px rgba(34,49,43,0.12);
        }
        .scan-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .scan-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(62,107,92,0.08) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(62,107,92,0.08) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .scan-line {
          position: absolute; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, #6FBFA6, transparent);
          box-shadow: 0 0 18px 4px rgba(111,191,166,0.5);
          animation: sweep 2.4s ease-in-out infinite;
        }
        @keyframes sweep { 0% { top: 2%; } 50% { top: 96%; } 100% { top: 2%; } }
        @media (prefers-reduced-motion: reduce) { .scan-line { animation: none; top: 50%; } }
        .scan-msg { font-family: 'Fraunces', serif; font-size: 19px; color: var(--ink); min-height: 28px; }
        .scan-sub { font-size: 13px; color: var(--ink-soft); margin-top: 8px; }

        .report-head { text-align: center; padding: 44px 0 6px; }
        .report-head .thumb {
          width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
          border: 3px solid var(--card); box-shadow: 0 2px 16px rgba(34,49,43,0.15);
          margin-bottom: 14px;
        }
        .report-head h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 28px; margin-bottom: 10px; }
        .report-head p { color: var(--ink-soft); font-size: 15px; line-height: 1.6; max-width: 480px; margin: 0 auto; }

        .card {
          background: var(--card); border: 1px solid var(--line); border-radius: 20px;
          padding: 26px; margin-top: 22px; box-shadow: 0 2px 24px rgba(34,49,43,0.04);
        }
        .card-label {
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--ink-soft); font-weight: 600; margin-bottom: 18px;
        }
        .zone { margin-bottom: 18px; }
        .zone:last-child { margin-bottom: 0; }
        .zone-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .zone-name { font-size: 14px; font-weight: 600; }
        .zone-score { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; }
        .bar { height: 6px; background: #EFE9E0; border-radius: 100px; overflow: hidden; }
        .bar > div { height: 100%; border-radius: 100px; width: 0; transition: width 1.1s cubic-bezier(.2,.7,.3,1); }
        .zone-obs { font-size: 12.5px; color: var(--ink-soft); margin-top: 6px; line-height: 1.45; }

        .strengths { display: flex; flex-direction: column; gap: 10px; }
        .strength { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.5; }
        .strength .dot { color: var(--sage); font-size: 16px; line-height: 1.3; }

        .treat { border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-bottom: 12px; }
        .treat:last-child { margin-bottom: 0; }
        .treat-top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
        .treat-name { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; }
        .treat-zone { font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
        .treat-benefit { font-size: 13.5px; color: var(--ink-soft); line-height: 1.5; margin-top: 2px; }

        .price-range {
          font-family: 'Fraunces', serif; font-size: 32px; font-weight: 600;
          color: var(--sage-deep); text-align: center; margin: 4px 0 6px;
        }
        .price-disclaimer {
          margin-top: 14px; background: var(--sage-soft); border-radius: 12px;
          padding: 10px 14px; font-size: 12.5px; color: var(--ink-soft);
          text-align: center; line-height: 1.5;
        }

        .sim-frame { position: relative; border-radius: 14px; overflow: hidden; }
        .sim-frame img { width: 100%; display: block; }
        .sim-tag {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: rgba(34,49,43,0.72); color: #FDFBF8;
          font-size: 12px; font-weight: 600; padding: 10px 14px;
          text-align: center; line-height: 1.4;
        }

        .cta-block {
          margin-top: 26px; text-align: center; background: var(--sage-deep);
          border-radius: 20px; padding: 32px 26px; color: #F2EFE9;
        }
        .cta-block h3 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 23px; margin-bottom: 8px; }
        .cta-block p { font-size: 14px; opacity: 0.85; line-height: 1.55; max-width: 380px; margin: 0 auto; }
        .cta-block .btn { background: var(--blush); color: var(--sage-deep); max-width: 340px; }
        .cta-block .btn:hover { background: #F0DACB; }
        .again { text-align: center; margin-top: 18px; }

        .form-card { max-width: 440px; margin: 44px auto 0; }
        .form-card h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 26px; text-align: center; margin-bottom: 8px; }
        .form-card .lead-sub { text-align: center; color: var(--ink-soft); font-size: 14px; margin-bottom: 24px; line-height: 1.55; }
        .field { margin-bottom: 16px; }
        .field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .field input, .field select {
          width: 100%; padding: 13px 16px; border: 1.5px solid var(--line);
          border-radius: 12px; font-family: inherit; font-size: 15px; color: var(--ink);
          background: #FDFCFA; outline: none; transition: border-color .2s;
        }
        .field input:focus, .field select:focus { border-color: var(--sage); }

        .done { text-align: center; padding: 72px 0 0; }
        .done .check {
          width: 68px; height: 68px; border-radius: 50%; background: var(--sage-soft);
          color: var(--sage); font-size: 30px; display: flex; align-items: center;
          justify-content: center; margin: 0 auto 22px;
        }
        .done h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 28px; margin-bottom: 12px; }
        .done p { color: var(--ink-soft); font-size: 15px; line-height: 1.65; max-width: 400px; margin: 0 auto; }

        footer {
          text-align: center; font-size: 11.5px; color: #9AA69F;
          margin-top: 48px; line-height: 1.6;
        }
      `}</style>

      <div className="wrap">
        <div className="topbar">
          <div className="brand">{marca.nombre}</div>
        </div>

        {view === "upload" && (
          <>
            <div className="hero">
              <div className="eyebrow">{hero.eyebrow}</div>
              <h1>{renderEmphasis(hero.titulo)}</h1>
              <p className="sub">{hero.subtitulo}</p>
            </div>

            <div className="uploader">
              {!photo ? (
                <div className="dropzone" onClick={() => fileRef.current?.click()}>
                  <div className="dz-icon">✦</div>
                  <div className="dz-title">{t.dropzone_titulo}</div>
                  <div className="dz-hint">{t.dropzone_hint}</div>
                </div>
              ) : (
                <div className="preview">
                  <img src={photo} alt="Tu foto" />
                  <div className="meta">
                    <b>{t.preview_titulo}</b>
                    <span>{t.preview_nota}</span>
                    <div style={{ marginTop: 6 }}>
                      <button className="link-btn" onClick={() => fileRef.current?.click()}>
                        {t.cambiar_foto}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={(e) => onFile(e.target.files?.[0])}
              />

              <div className="consent">
                <input
                  id="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor="consent">
                  Acepto que mi foto se analice para preparar un informe orientativo.
                  La imagen se descarta tras el análisis y no se almacena.
                  Consulta la{" "}
                  <a href="/privacidad.html" target="_blank" rel="noopener" style={{ color: "var(--sage)" }}>
                    política de privacidad
                  </a>.
                </label>
              </div>

              <button className="btn" disabled={!photo || !consent} onClick={analyze}>
                {t.boton_analizar}
              </button>

              {error && <div className="error">{error}</div>}
            </div>

            <p className="privacy-note">{t.nota_privacidad}</p>
          </>
        )}

        {view === "analyzing" && (
          <div className="scan-stage">
            <div className="scan-frame">
              <img src={photo} alt="Analizando tu foto" />
              <div className="scan-grid" />
              <div className="scan-line" />
            </div>
            <div className="scan-msg">{mensajesCarga[msgIdx]}</div>
            <div className="scan-sub">{t.scan_sub}</div>
          </div>
        )}

        {view === "report" && result && (
          <>
            <div className="report-head">
              <img className="thumb" src={photo} alt="" />
              <h2>{t.informe_titulo}</h2>
              <p>{result.resumen}</p>
            </div>

            {result.bloques?.map((b, i) => renderBloque(b, i, barsOn))}

            <div className="cta-block">
              <h3>{respuesta.cta.titulo}</h3>
              <p>{respuesta.cta.texto}</p>
              <button className="btn" onClick={() => setView("form")}>
                {respuesta.cta.texto_boton}
              </button>
            </div>

            <div className="again">
              <button className="link-btn" onClick={reset}>{t.analizar_otra}</button>
            </div>
          </>
        )}

        {view === "form" && (
          <div className="card form-card">
            <h2>{t.form_titulo}</h2>
            <p className="lead-sub">{t.form_subtitulo}</p>

            {campos.includes("nombre") && (
              <div className="field">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  type="text"
                  placeholder="Tu nombre"
                  value={lead.nombre}
                  onChange={(e) => setLead({ ...lead, nombre: e.target.value })}
                />
              </div>
            )}

            {campos.includes("telefono") && (
              <div className="field">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  type="tel"
                  placeholder="600 000 000"
                  value={lead.telefono}
                  onChange={(e) => setLead({ ...lead, telefono: e.target.value })}
                />
              </div>
            )}

            {campos.includes("franja") && (
              <div className="field">
                <label htmlFor="franja">¿Cuándo prefieres que te llamemos?</label>
                <select
                  id="franja"
                  value={lead.franja}
                  onChange={(e) => setLead({ ...lead, franja: e.target.value })}
                >
                  <option>Mañanas</option>
                  <option>Mediodía</option>
                  <option>Tardes</option>
                </select>
              </div>
            )}

            <button className="btn" disabled={!formValido || sending} onClick={submitLead}>
              {sending ? t.form_boton_enviando : t.form_boton}
            </button>
            <div className="again">
              <button className="link-btn" onClick={() => setView("report")}>{t.volver_informe}</button>
            </div>
          </div>
        )}

        {view === "done" && (
          <div className="done">
            <div className="check">✓</div>
            <h2>{t.done_saludo}, {lead.nombre.split(" ")[0]}!</h2>
            <p>
              Hemos enviado tu solicitud a {marca.nombre}.
              {campos.includes("franja") && (
                <> Te llamaremos por las <b>{lead.franja.toLowerCase()}</b></>
              )}
              {campos.includes("telefono") && (
                <> al <b>{lead.telefono}</b></>
              )}{" "}
              para darte cita.
            </p>
            <div className="again" style={{ marginTop: 24 }}>
              <button className="btn ghost" style={{ width: "auto", padding: "12px 28px" }} onClick={reset}>
                {t.analizar_otra}
              </button>
            </div>
          </div>
        )}

        <footer>
          {footer}
          <br />
          {marca.nombre}
        </footer>
      </div>
    </div>
  );
}
