import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
// VERSIÓN PRODUCCIÓN — Landing interactiva de análisis estético
// La llamada a la IA pasa por tu webhook de n8n (la clave API
// vive en n8n, nunca en el navegador).
//
// CONFIGURA ESTAS DOS URLS ANTES DE DESPLEGAR:
// ─────────────────────────────────────────────────────────────

// URL de PRODUCCIÓN del webhook de análisis (workflow "Landing IA — Análisis de piel")
const WEBHOOK_URL = "https://random-n8n.9zi4ji.easypanel.host/webhook/analisis-piel";

// Opcional: webhook para notificar el lead a la clínica (WhatsApp/email/Airtable).
// Si lo dejas vacío (""), el formulario funciona pero no envía nada.
const LEAD_WEBHOOK_URL = "";

const LOADING_MSGS = [
  "Mapeando zonas faciales…",
  "Evaluando luminosidad y tono…",
  "Analizando textura e hidratación…",
  "Midiendo líneas de expresión…",
  "Preparando tu informe personalizado…",
];

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

  useEffect(() => {
    if (view !== "analyzing") return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 1900);
    return () => clearInterval(t);
  }, [view]);

  useEffect(() => {
    if (view === "report") {
      setBarsOn(false);
      const t = setTimeout(() => setBarsOn(true), 150);
      return () => clearTimeout(t);
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
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: imgB64.current }),
      });
      if (!response.ok) throw new Error(`Webhook respondió ${response.status}`);
      const parsed = await response.json();
      if (!parsed.es_rostro) {
        setError(
          parsed.motivo ||
            "No hemos detectado un rostro en la foto. Prueba con una foto de frente y con buena luz."
        );
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
    if (!lead.nombre.trim() || lead.telefono.trim().length < 9 || sending) return;
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
            recomendaciones: result?.recomendaciones || [],
            origen: "landing-analisis-piel",
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

  const scoreTone = (n) => (n >= 75 ? "var(--sage)" : n >= 55 ? "var(--amber)" : "var(--clay)");

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

        :root {
          --bg: #FBF8F4;
          --card: #FFFFFF;
          --ink: #22312B;
          --ink-soft: #5C6B63;
          --sage: #3E6B5C;
          --sage-deep: #2C5044;
          --blush: #EBCDBB;
          --amber: #C89A4B;
          --clay: #B96B4F;
          --line: #E7DFD5;
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
        .brand { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }
        .brand span { color: var(--sage); }

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
        .dropzone:hover { border-color: var(--sage); background: #F6F9F7; }
        .dz-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: #EDF3F0; color: var(--sage);
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
        .treat-sessions {
          font-size: 11.5px; font-weight: 600; color: var(--sage);
          background: #EDF3F0; padding: 4px 10px; border-radius: 100px; white-space: nowrap;
        }
        .treat-zone { font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
        .treat-benefit { font-size: 13.5px; color: var(--ink-soft); line-height: 1.5; }

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
          width: 68px; height: 68px; border-radius: 50%; background: #EDF3F0;
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
          <div className="brand">Clínica <span>Aura</span></div>
        </div>

        {view === "upload" && (
          <>
            <div className="hero">
              <div className="eyebrow">Medicina estética · Diagnóstico con IA</div>
              <h1>Descubre lo que tu piel <em>necesita</em> en 30 segundos</h1>
              <p className="sub">
                Sube una foto de tu rostro y nuestra IA te preparará un informe
                personalizado con el estado de tu piel y los tratamientos que mejor te irían.
              </p>
            </div>

            <div className="uploader">
              {!photo ? (
                <div className="dropzone" onClick={() => fileRef.current?.click()}>
                  <div className="dz-icon">✦</div>
                  <div className="dz-title">Sube tu foto o hazte un selfie</div>
                  <div className="dz-hint">De frente, con buena luz y sin maquillaje si es posible</div>
                </div>
              ) : (
                <div className="preview">
                  <img src={photo} alt="Tu foto" />
                  <div className="meta">
                    <b>Foto lista para analizar</b>
                    <span>Se procesa de forma segura y no se almacena.</span>
                    <div style={{ marginTop: 6 }}>
                      <button className="link-btn" onClick={() => fileRef.current?.click()}>
                        Cambiar foto
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
                  Acepto que mi foto se analice con inteligencia artificial para generar
                  un informe orientativo. La imagen se descarta tras el análisis y no se almacena.
                  Consulta la{" "}
                  <a href="/privacidad.html" target="_blank" rel="noopener" style={{ color: "var(--sage)" }}>
                    política de privacidad
                  </a>.
                </label>
              </div>

              <button className="btn" disabled={!photo || !consent} onClick={analyze}>
                Analizar mi piel →
              </button>

              {error && <div className="error">{error}</div>}
            </div>

            <p className="privacy-note">
              Análisis gratuito y sin compromiso · Resultados al instante
            </p>
          </>
        )}

        {view === "analyzing" && (
          <div className="scan-stage">
            <div className="scan-frame">
              <img src={photo} alt="Analizando tu foto" />
              <div className="scan-grid" />
              <div className="scan-line" />
            </div>
            <div className="scan-msg">{LOADING_MSGS[msgIdx]}</div>
            <div className="scan-sub">Esto suele tardar unos 15 segundos</div>
          </div>
        )}

        {view === "report" && result && (
          <>
            <div className="report-head">
              <img className="thumb" src={photo} alt="" />
              <h2>Tu informe de piel</h2>
              <p>{result.resumen}</p>
            </div>

            <div className="card">
              <div className="card-label">Análisis por zonas</div>
              {result.zonas?.map((z, i) => (
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

            {result.fortalezas?.length > 0 && (
              <div className="card">
                <div className="card-label">Lo que tu piel ya hace bien</div>
                <div className="strengths">
                  {result.fortalezas.map((f, i) => (
                    <div className="strength" key={i}>
                      <span className="dot">✦</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-label">Tratamientos recomendados para ti</div>
              {result.recomendaciones?.map((r, i) => (
                <div className="treat" key={i}>
                  <div className="treat-top">
                    <span className="treat-name">{r.tratamiento}</span>
                    <span className="treat-sessions">{r.sesiones}</span>
                  </div>
                  <div className="treat-zone">{r.zona}</div>
                  <div className="treat-benefit">{r.beneficio}</div>
                </div>
              ))}
            </div>

            <div className="cta-block">
              <h3>¿Quieres verlo en persona?</h3>
              <p>
                Reserva una valoración gratuita con nuestro equipo médico.
                Revisaremos tu informe contigo, sin compromiso.
              </p>
              <button className="btn" onClick={() => setView("form")}>
                Quiero mi valoración gratuita
              </button>
            </div>

            <div className="again">
              <button className="link-btn" onClick={reset}>Analizar otra foto</button>
            </div>
          </>
        )}

        {view === "form" && (
          <div className="card form-card">
            <h2>Reserva tu valoración</h2>
            <p className="lead-sub">
              Déjanos tus datos y te llamamos para darte cita. Sin compromiso.
            </p>
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
            <button
              className="btn"
              disabled={!lead.nombre.trim() || lead.telefono.trim().length < 9 || sending}
              onClick={submitLead}
            >
              {sending ? "Enviando…" : "Enviar y reservar"}
            </button>
            <div className="again">
              <button className="link-btn" onClick={() => setView("report")}>← Volver al informe</button>
            </div>
          </div>
        )}

        {view === "done" && (
          <div className="done">
            <div className="check">✓</div>
            <h2>¡Listo, {lead.nombre.split(" ")[0]}!</h2>
            <p>
              Hemos enviado tu solicitud a Clínica Aura.
              Te llamaremos por las <b>{lead.franja.toLowerCase()}</b> al{" "}
              <b>{lead.telefono}</b> para darte cita.
            </p>
            <div className="again" style={{ marginTop: 24 }}>
              <button className="btn ghost" style={{ width: "auto", padding: "12px 28px" }} onClick={reset}>
                Analizar otra foto
              </button>
            </div>
          </div>
        )}

        <footer>
          Análisis orientativo generado con inteligencia artificial.
          No constituye un diagnóstico médico.
          <br />
          Clínica Aura
        </footer>
      </div>
    </div>
  );
}
