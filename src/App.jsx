import { useState, useRef, useEffect } from "react";
import config from "./configs/activo.js";
import { capturarUnaVez, tramoEdad } from "./posthog.js";

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
// CONFIGURA ESTA URL ANTES DE DESPLEGAR:
// ─────────────────────────────────────────────────────────────

// El análisis ya no llama a n8n directamente desde el navegador — pasa por
// api/analisis.js (proxy serverless), que valida origen y límite de
// peticiones antes de reenviar. La URL real del webhook de n8n vive solo
// ahí, como variable de entorno sin prefijo VITE_ (N8N_ANALISIS_WEBHOOK_URL),
// para que no vuelva a acabar en el bundle público.

// Opcional: webhook para notificar el lead a la clínica (WhatsApp/email/Airtable).
// Si lo dejas vacío (""), el formulario funciona pero no envía nada.
const LEAD_WEBHOOK_URL = "https://random-n8n.9zi4ji.easypanel.host/webhook/landing-leads";

// Opcional: webhook del formulario de cualificación (ver componente
// Cualificacion). Se define por variable de entorno (documentada en
// .env.example y README) en vez de hardcodeada: si no está definida, el
// formulario calcula y muestra igualmente la horquilla de precio al lead,
// simplemente no hay POST.
const CUALIFICACION_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_CUALIFICACION;

const { marca, analisis, respuesta, captura, cualificacion, onboarding, encuesta_espera: encuestaEspera } = config;
const { colores, hero, textos_upload: t, footer } = marca;
const capturaModo = captura === "camara" ? "camara" : "galeria";

// Convierte "texto *destacado*" en JSX con <em> en la parte marcada
function renderEmphasis(text) {
  const parts = text.split(/\*(.+?)\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

// Convierte "texto **destacado**" en JSX con <strong> en la parte marcada
function renderBold(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

const scoreTone = (n) => (n >= 75 ? "var(--sage)" : n >= 55 ? "var(--amber)" : "var(--clay)");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formato real de un teléfono español: 9 dígitos empezando por 6/7 (móvil)
// u 8/9 (fijo), con prefijo internacional opcional. No basta con "9 dígitos
// cualquiera" (eso aceptaría cosas como 111111111): tiene que empezar por
// un prefijo que exista de verdad.
const PHONE_RE = /^(?:\+34|0034)?[6789]\d{8}$/;
const telefonoValido = (valor) => {
  const limpio = (valor || "").replace(/[\s-]+/g, "");
  if (!PHONE_RE.test(limpio)) return false;
  // Además del formato, exige variedad mínima de dígitos: un número real
  // casi nunca se repite tan poco. Filtra números "de prueba" tipo
  // 666777888 o 666666666, que cumplirían el formato pero no son reales.
  const digitos = limpio.replace(/^(\+34|0034)/, "");
  return new Set(digitos).size >= 4;
};

// Lee una cookie del navegador (usada para _fbp/_fbc, ver evento Lead más
// abajo). Devuelve null si no existe — nunca cadena vacía.
function leerCookie(nombre) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Formulario de cualificación: scoring y horquilla de precio ────────
// Funciones puras: todos los números de negocio vienen de
// cualificacion.pesos / cualificacion.rangos_precio (config del cliente),
// nunca hardcodeados aquí.

// Score parcial sobre 85 (n8n añade después distancia y renta del
// municipio, los 15 puntos restantes — por eso el cliente no calcula
// distancia).
function calcularScoreCualificacion(pesos, respuestas) {
  const historial = pesos.historial.valores[respuestas.historial] || 0;
  const recurrencia = pesos.recurrencia.valores[respuestas.recurrencia] || 0;

  const pesoObjetivo = (respuestas.objetivo || [])
    .reduce((max, o) => Math.max(max, pesos.valor_anual.objetivo[o] || 0), 0);
  const factor = pesos.valor_anual.factor_presupuesto[respuestas.presupuesto] || 0;
  const valor_anual = Math.round(pesoObjetivo * factor);

  let plazo = pesos.plazo.valores[respuestas.plazo] || 0;
  if (respuestas.detonante && respuestas.detonante !== "Ninguno en especial") {
    plazo = Math.min(pesos.plazo.max, plazo + pesos.plazo.bonus_detonante);
  }

  return { historial, recurrencia, valor_anual, plazo, total: historial + recurrencia + valor_anual + plazo };
}

// Horquilla de precio mostrada al lead como recompensa por responder:
// toma el objetivo de mayor peso entre los seleccionados (mismo criterio
// que usa valor_anual en el score) y cruza su rango habitual con la banda
// de presupuesto elegida. Si no hay solape, muestra el rango propio del
// objetivo tal cual, sin forzar un cruce que no tiene sentido.
function calcularHorquillaCualificacion(rangosPrecio, pesosObjetivo, respuestas) {
  const objetivos = respuestas.objetivo || [];
  if (!objetivos.length) return null;
  const principal = objetivos.reduce(
    (mejor, o) => ((pesosObjetivo[o] || 0) > (pesosObjetivo[mejor] || 0) ? o : mejor),
    objetivos[0]
  );
  const base = rangosPrecio.objetivo[principal];
  const banda = rangosPrecio.presupuesto[respuestas.presupuesto];
  if (!base || !banda) return null;
  const min = Math.max(base.min, banda.min);
  const max = Math.min(base.max, banda.max);
  return { ...(min <= max ? { min, max } : base), moneda: rangosPrecio.moneda };
}

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
        {/* ph-no-capture: muestra el rostro del usuario (simulación),
            igual que la foto capturada — nunca en el session replay. */}
        <img className="ph-no-capture" src={url} alt="Simulación del resultado" />
        {/* Etiqueta legal siempre visible superpuesta a la imagen, nunca oculta */}
        {etiqueta_legal && <div className="sim-tag">{etiqueta_legal}</div>}
      </div>
    </div>
  );
}

const TEXTO_CONFIANZA_CAMARA =
  "Tu foto se analiza al momento y no se almacena en ningún servidor.";

// URLs de los assets estáticos del motor de detección facial de MediaPipe
// (runtime WASM + modelo .tflite). Solo se piden una vez, al montar el
// componente de cámara, y son exactamente los mismos assets públicos que
// sirve MediaPipe para cualquier web: no dependen del usuario ni de su foto.
const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

const AUTOCAPTURE_ESTABLE_MS = 1500;
const DETECCION_INTERVALO_MS = 150;
// Red de seguridad, no una promesa de velocidad: el workflow real de n8n
// está tardando ~20-30s. Súbelo si sigue abortando análisis que sí
// funcionan; bájalo solo cuando el workflow de n8n responda más rápido.
const ANALYSIS_TIMEOUT_MS = 40000;

// Clasifica el recuadro de rostro que devuelve MediaPipe contra la zona del
// óvalo guía (centro del encuadre). Todo esto ocurre con los números que ya
// están en memoria del navegador; no se compara nada contra un servidor.
//
// El vídeo "crudo" de la cámara (normalmente 16:9 o 4:3) no tiene el mismo
// encuadre que el recuadro 3:4 en pantalla: se pinta con object-fit:cover,
// que recorta los bordes sobrantes. MediaPipe devuelve las coordenadas del
// rostro en el sistema de coordenadas del vídeo crudo, así que hay que
// convertirlas al recorte visible antes de compararlas contra el óvalo —
// si no, casi cualquier posición del rostro sale "centrada".
function clasificarRostro(box, video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const rect = video.getBoundingClientRect();
  if (!vw || !vh || !rect.width || !rect.height) return { tono: "none" };

  const scale = Math.max(rect.width / vw, rect.height / vh);
  const cropX = (vw * scale - rect.width) / 2;
  const cropY = (vh * scale - rect.height) / 2;
  const aPantallaX = (px) => (px * scale - cropX) / rect.width;
  const aPantallaY = (py) => (py * scale - cropY) / rect.height;

  const cx = aPantallaX(box.originX + box.width / 2);
  const cy = aPantallaY(box.originY + box.height / 2);
  const wRatio = (box.width * scale) / rect.width;

  if (wRatio < 0.22) return { tono: "off", razon: "lejos" };
  if (wRatio > 0.72) return { tono: "off", razon: "cerca" };
  if (cx < 0.3 || cx > 0.7 || cy < 0.22 || cy > 0.78) return { tono: "off", razon: "descentrado" };
  return { tono: "centered" };
}

// Captura por cámara frontal en vivo (getUserMedia) con detección real de
// rostro vía MediaPipe Face Detection, corriendo enteramente en el navegador
// (WebAssembly, on-device). El vídeo, los recuadros detectados y cualquier
// coordenada derivada NUNCA salen del navegador: no hay ningún fetch/POST
// con esos datos en este componente. Las únicas peticiones de red que hace
// son las de MEDIAPIPE_WASM_URL / MEDIAPIPE_MODEL_URL (assets estáticos del
// motor, no datos del usuario) y ocurren una sola vez al montar.
//
// Si el permiso de cámara se deniega, no hay cámara, o MediaPipe no carga
// (red, dispositivo sin WebAssembly/GPU), se degrada a captura manual: el
// óvalo se queda neutro y el usuario dispara la foto con el botón, igual
// que en la versión sin detección. Como último recurso, se ofrece subir
// una foto desde la galería (mejor un lead con foto que ningún lead).
function CameraCapture({ onFile }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fallbackFileRef = useRef(null);
  const detectorRef = useRef(null);
  const stableSinceRef = useRef(null);
  const lastDetectAtRef = useRef(0);
  const countdownActiveRef = useRef(false);
  const countdownTimeoutsRef = useRef([]);

  const [status, setStatus] = useState("idle"); // idle | starting | live | captured | error
  const [shot, setShot] = useState(null);
  const [detection, setDetection] = useState("loading"); // loading | unsupported | none | off | centered
  const [offReason, setOffReason] = useState(null); // lejos | cerca | descentrado
  const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const clearCountdownTimeouts = () => {
    countdownTimeoutsRef.current.forEach(clearTimeout);
    countdownTimeoutsRef.current = [];
  };

  const cancelCountdown = () => {
    if (!countdownActiveRef.current) return;
    countdownActiveRef.current = false;
    clearCountdownTimeouts();
    setCountdown(null);
  };

  // Conecta el stream activo al <video> actual. Hace falta como paso propio
  // (no solo dentro de startCamera) porque tras capturar, el <video> se
  // desmonta (se sustituye por el <img> de la foto) y al "Repetir" se monta
  // un <video> nuevo sin srcObject: hay que reengancharle el stream, que
  // sigue vivo de fondo (capture() no lo para).
  const attachStream = async (video, stream) => {
    if (!video || !stream) return;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (playErr) {
      // Reasignar srcObject (p. ej. la segunda invocación de StrictMode, o
      // un reenganche casi simultáneo) aborta el play() anterior con
      // AbortError: no es un fallo real de la cámara, se puede ignorar.
      if (playErr?.name !== "AbortError") setStatus("error");
    }
  };

  const startCamera = async () => {
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      // Detiene un stream anterior si lo hubiera (p. ej. doble invocación
      // de efectos en desarrollo con StrictMode) para no dejarlo abierto.
      stopStream();
      streamRef.current = stream;
      await attachStream(videoRef.current, stream);
      setStatus("live");
      capturarUnaVez("camara_abierta");
    } catch (e) {
      setStatus("error");
    }
  };

  // Reengancha el stream cada vez que el estado pasa a "live" con un
  // <video> nuevo en el DOM (típicamente tras pulsar "Repetir").
  useEffect(() => {
    if (status === "live") attachStream(videoRef.current, streamRef.current);
  }, [status]);

  // OJO: no se llama a startCamera() aquí. Pedir la cámara automáticamente
  // al montar (sin gesto directo del usuario) hace que varios navegadores
  // Android — sobre todo Samsung Internet — rechacen getUserMedia en
  // silencio, sin llegar a mostrar el diálogo de permiso. Por eso el
  // primer paso siempre es un botón que el usuario toca (ver status
  // "idle" más abajo): eso sí cuenta como gesto directo en todos lados.
  useEffect(() => {
    return () => {
      stopStream();
      clearCountdownTimeouts();
    };
  }, []);

  // Carga (una vez) el detector facial de MediaPipe. Si falla por cualquier
  // motivo, "unsupported" hace que el resto del componente se comporte
  // exactamente como la captura manual original, sin romper el flujo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const baseOptions = (delegate) => ({
          baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate },
          runningMode: "VIDEO",
        });
        let detector;
        try {
          detector = await FaceDetector.createFromOptions(vision, baseOptions("GPU"));
        } catch {
          // Algunos dispositivos/navegadores no exponen delegate GPU vía WebGL;
          // se reintenta en CPU antes de darnos por vencidos.
          detector = await FaceDetector.createFromOptions(vision, baseOptions("CPU"));
        }
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setDetection("none");
      } catch (e) {
        if (!cancelled) setDetection("unsupported");
      }
    })();
    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  const capture = () => {
    cancelCountdown();
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setShot(canvas.toDataURL("image/jpeg", 0.9));
    setStatus("captured");
    capturarUnaVez("foto_capturada");
  };

  const startCountdown = () => {
    countdownActiveRef.current = true;
    setCountdown(3);
    countdownTimeoutsRef.current = [
      setTimeout(() => countdownActiveRef.current && setCountdown(2), 700),
      setTimeout(() => countdownActiveRef.current && setCountdown(1), 1400),
      setTimeout(() => {
        if (!countdownActiveRef.current) return;
        countdownActiveRef.current = false;
        setCountdown(null);
        capture();
      }, 2100),
    ];
  };

  // Se llama en cada ciclo de detección con el resultado real de MediaPipe:
  // el óvalo y el texto guía, y el disparo del autocaptura, dependen solo de
  // esto — nunca de un temporizador ciego.
  const evaluateDetection = (result, video) => {
    const box = result?.detections?.[0]?.boundingBox;
    if (!box) {
      stableSinceRef.current = null;
      cancelCountdown();
      setDetection((prev) => (prev === "none" ? prev : "none"));
      setOffReason(null);
      return;
    }

    const { tono, razon } = clasificarRostro(box, video);

    if (tono !== "centered") {
      stableSinceRef.current = null;
      cancelCountdown();
      setDetection((prev) => (prev === "off" ? prev : "off"));
      setOffReason(razon);
      return;
    }

    setOffReason(null);
    setDetection((prev) => (prev === "centered" ? prev : "centered"));
    if (stableSinceRef.current == null) stableSinceRef.current = performance.now();
    const elapsed = performance.now() - stableSinceRef.current;
    if (elapsed >= AUTOCAPTURE_ESTABLE_MS && !countdownActiveRef.current) {
      startCountdown();
    }
  };

  // Bucle de detección sobre la vista en vivo. Se apoya en refs (no en
  // estado de React) para leer siempre el detector/último frame al día,
  // así no hay que reiniciar el bucle cada vez que cambia el estado visual.
  useEffect(() => {
    if (status !== "live") return;
    let raf;
    const loop = () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      const now = performance.now();
      if (video && detector && video.readyState >= 2 && now - lastDetectAtRef.current >= DETECCION_INTERVALO_MS) {
        lastDetectAtRef.current = now;
        try {
          evaluateDetection(detector.detectForVideo(video, now), video);
        } catch (e) {
          // Frame puntual no procesable (p. ej. justo tras un resize); se
          // reintenta en el siguiente ciclo sin interrumpir la cámara.
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const retake = () => {
    stableSinceRef.current = null;
    cancelCountdown();
    setDetection((prev) => (prev === "unsupported" || prev === "loading" ? prev : "none"));
    setOffReason(null);
    setStatus("live");
    capturarUnaVez("foto_repetida");
  };

  const usePhoto = async () => {
    const blob = await (await fetch(shot)).blob();
    stopStream();
    capturarUnaVez("foto_confirmada");
    onFile(new File([blob], "captura.jpg", { type: "image/jpeg" }));
  };

  if (status === "idle") {
    return (
      <div className="camera-wrap">
        <div className="camera-frame">
          <div className="camera-idle">
            <div className="camera-idle-icon">📷</div>
            <div className="camera-idle-text">Toca para activar la cámara</div>
          </div>
          <div className="camera-oval" />
        </div>
        <div className="camera-trust">{TEXTO_CONFIANZA_CAMARA}</div>
        <button className="btn" onClick={startCamera}>Activar cámara</button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="camera-error">
        <div className="camera-error-msg">
          No hemos podido acceder a tu cámara. Revisa los permisos del navegador
          o sube una foto desde tu galería.
        </div>
        <button className="btn ghost" onClick={startCamera}>Reintentar cámara</button>
        <button
          className="link-btn"
          style={{ display: "block", margin: "14px auto 0" }}
          onClick={() => fallbackFileRef.current?.click()}
        >
          Subir foto desde galería
        </button>
        <input
          ref={fallbackFileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
    );
  }

  const ovalTono = detection === "off" ? "tone-off" : detection === "centered" ? "tone-centered" : "";

  let guideText = "Centra tu rostro en el marco, con buena luz";
  if (status === "live") {
    if (detection === "loading") guideText = "Cargando el escaneo…";
    else if (detection === "none") guideText = "No detectamos tu rostro. Colócate frente a la cámara.";
    else if (detection === "off") {
      guideText =
        offReason === "lejos" ? "Acércate un poco" : offReason === "cerca" ? "Aléjate un poco" : "Céntrate en el óvalo";
    } else if (detection === "centered") {
      guideText = countdown != null ? "¡Perfecto, no te muevas!" : "Rostro centrado, manteniendo…";
    }
  }

  return (
    <div className="camera-wrap">
      <div className="camera-frame">
        {/* ph-no-capture en ambos: la promesa de "tu foto no se almacena"
            incluye no grabarla en el session replay, ni la vista en vivo
            de la cámara ni la foto ya capturada. */}
        {status === "captured" ? (
          <img className="ph-no-capture" src={shot} alt="Foto capturada" />
        ) : (
          <video className="ph-no-capture" ref={videoRef} playsInline muted autoPlay />
        )}
        {status !== "captured" && (
          <>
            <div className={`camera-oval ${ovalTono}`} />
            {countdown != null && <div className="camera-countdown">{countdown}</div>}
            <div className="camera-guide">{guideText}</div>
          </>
        )}
      </div>
      <div className="camera-trust">{TEXTO_CONFIANZA_CAMARA}</div>
      {status === "captured" ? (
        <div className="camera-actions">
          <button className="btn ghost" onClick={retake}>Repetir</button>
          <button className="btn" onClick={usePhoto}>Usar esta foto</button>
        </div>
      ) : (
        <button className="btn" disabled={status !== "live"} onClick={capture}>
          {status === "starting" ? "Activando cámara…" : "Capturar foto"}
        </button>
      )}
    </div>
  );
}

function LeadFormFields({ campos, lead, setLead }) {
  return (
    <>
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

      {campos.includes("email") && (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={lead.email}
            onChange={(e) => setLead({ ...lead, email: e.target.value })}
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
    </>
  );
}

// ── Formulario de cualificación (post-desbloqueo) ──────────────────────
// Una pregunta por pantalla, config-driven al 100% (cfg = cualificacion del
// cliente activo). Se muestra solo tras desbloquear el informe; nunca antes.

function esPasoValido(pregunta, respuestas) {
  if (pregunta.opcional) return true;
  const valor = respuestas[pregunta.id];
  if (pregunta.tipo === "multi") return Array.isArray(valor) && valor.length > 0;
  if (pregunta.tipo === "texto") return !!valor && valor.trim().length > 0;
  return !!valor;
}

// Construye la lista de pasos a partir de cfg.preguntas, insertando la
// subpregunta (p. ej. "detonante") solo si la respuesta actual a su
// pregunta padre está en subpregunta.mostrar_si. Se recalcula cada render:
// barato con 6-7 preguntas y evita índices hardcodeados.
function construirPasos(preguntas, respuestas) {
  const pasos = [];
  for (const p of preguntas) {
    pasos.push(p);
    if (p.subpregunta && p.subpregunta.mostrar_si.includes(respuestas[p.id])) {
      pasos.push(p.subpregunta);
    }
  }
  return pasos;
}

function Cualificacion({ cfg, marca, lead }) {
  const [respuestas, setRespuestas] = useState({});
  const [pasoIdx, setPasoIdx] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);

  const pasos = construirPasos(cfg.preguntas, respuestas);
  // Si la respuesta a "plazo" cambia y hace desaparecer la subpregunta,
  // pasoIdx podría apuntar fuera de rango: lo recortamos al último paso.
  const pasoIdx_ = Math.min(pasoIdx, pasos.length - 1);
  const pasoActual = pasos[pasoIdx_];
  const esUltimo = pasoIdx_ === pasos.length - 1;
  const valido = esPasoValido(pasoActual, respuestas);

  const setSingle = (id, opcion) => setRespuestas((r) => ({ ...r, [id]: opcion }));
  const toggleMulti = (id, opcion) =>
    setRespuestas((r) => {
      const actual = r[id] || [];
      return { ...r, [id]: actual.includes(opcion) ? actual.filter((o) => o !== opcion) : [...actual, opcion] };
    });
  const setTexto = (id, valor) => setRespuestas((r) => ({ ...r, [id]: valor }));

  const siguiente = () => {
    if (!valido) return;
    if (esUltimo) {
      enviar();
    } else {
      setPasoIdx(pasoIdx_ + 1);
    }
  };
  const atras = () => setPasoIdx(Math.max(0, pasoIdx_ - 1));

  const enviar = async () => {
    const score = calcularScoreCualificacion(cfg.pesos, respuestas);
    const horquilla = calcularHorquillaCualificacion(cfg.rangos_precio, cfg.pesos.valor_anual.objetivo, respuestas);
    setResultado(horquilla);
    setEnviando(true);
    capturarUnaVez("cualificacion_completada");
    if (CUALIFICACION_WEBHOOK_URL) {
      try {
        await fetch(CUALIFICACION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: marca.nombre.toLowerCase().replace(/\s+/g, "-"),
            email: lead.email?.trim() || "",
            telefono: lead.telefono?.trim() || "",
            respuestas,
            score_parcial: score.total,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // No bloqueamos la vista: el lead ya tiene su horquilla en pantalla
        // aunque el envío falle (red caída, webhook no configurado, etc.)
        console.error("Error enviando cualificación:", e);
      }
    }
    setEnviando(false);
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="qual-section">
        <div className="qual-card qual-result">
          <div className="card-label">Tu horquilla orientativa</div>
          {resultado ? (
            <div className="price-range">
              {resultado.min === resultado.max
                ? `${resultado.min} ${resultado.moneda}`
                : `${resultado.min}–${resultado.max} ${resultado.moneda}`}
            </div>
          ) : (
            <p className="zone-obs" style={{ textAlign: "center" }}>
              Gracias por tus respuestas.
            </p>
          )}
          <div className="price-disclaimer">{cfg.disclaimer}</div>
        </div>
      </div>
    );
  }

  const municipiosSugeridos =
    pasoActual.tipo === "texto" && pasoActual.autocompletar === "municipios"
      ? (cfg.municipios || [])
          .filter((m) => m.toLowerCase().includes((respuestas.municipio || "").toLowerCase()))
          .slice(0, 6)
      : [];

  return (
    <div className="qual-section">
      <div className="qual-card">
        <h3 className="qual-title">{cfg.titulo}</h3>
        <p className="qual-subtitle">{cfg.subtitulo}</p>

        <div className="qual-progress-track">
          <div className="qual-progress-bar" style={{ width: `${((pasoIdx_ + 1) / pasos.length) * 100}%` }} />
        </div>

        <div className="qual-step" key={pasoIdx_}>
          <div className="qual-question">
            {pasoActual.pregunta}
            {pasoActual.opcional && <span className="qual-opcional"> (opcional)</span>}
          </div>

          {pasoActual.mostrar_anclaje && <div className="qual-anchor">{cfg.anclaje_precio}</div>}

          {pasoActual.tipo === "texto" ? (
            <div className="qual-text-wrap">
              <input
                type="text"
                className="qual-text-input"
                placeholder={pasoActual.placeholder}
                value={respuestas[pasoActual.id] || ""}
                onChange={(e) => setTexto(pasoActual.id, e.target.value)}
                onFocus={() => setSugerenciasAbiertas(true)}
                onBlur={() => setTimeout(() => setSugerenciasAbiertas(false), 120)}
              />
              {sugerenciasAbiertas && municipiosSugeridos.length > 0 && (
                <ul className="qual-suggestions">
                  {municipiosSugeridos.map((m) => (
                    <li
                      key={m}
                      className="qual-suggestion"
                      onMouseDown={() => setTexto(pasoActual.id, m)}
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="qual-options">
              {pasoActual.opciones.map((o) => {
                const seleccionado =
                  pasoActual.tipo === "multi"
                    ? (respuestas[pasoActual.id] || []).includes(o)
                    : respuestas[pasoActual.id] === o;
                return (
                  <button
                    key={o}
                    type="button"
                    className={`qual-option${seleccionado ? " selected" : ""}`}
                    onClick={() =>
                      pasoActual.tipo === "multi" ? toggleMulti(pasoActual.id, o) : setSingle(pasoActual.id, o)
                    }
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="qual-nav">
          {pasoIdx_ > 0 && (
            <button type="button" className="btn ghost" onClick={atras}>
              {cfg.boton_atras}
            </button>
          )}
          <button type="button" className="btn" disabled={!valido || enviando} onClick={siguiente}>
            {esUltimo ? (enviando ? cfg.boton_enviando : cfg.boton_enviar) : cfg.boton_siguiente}
          </button>
        </div>
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

const onboardingActivo = !!onboarding?.activo;

// ── Tutorial de bienvenida (antes de pedir cámara/foto) ────────────────
// Un paso por pantalla, config-driven (cfg = onboarding del cliente
// activo). Solo cuando el usuario termina (o si onboarding.activo es
// false) se llega a la vista "upload", que es la que monta CameraCapture
// y dispara el permiso de cámara — así el permiso nunca se pide antes de
// que el usuario sepa para qué es.
function Onboarding({ cfg, onFinish }) {
  const [pasoIdx, setPasoIdx] = useState(0);
  const paso = cfg.pasos[pasoIdx];
  const esUltimo = pasoIdx === cfg.pasos.length - 1;

  const siguiente = () => {
    const numeroPaso = pasoIdx + 1;
    capturarUnaVez("tutorial_paso_completado", { paso: numeroPaso }, `tutorial_paso_completado_${numeroPaso}`);
    if (esUltimo) onFinish();
    else setPasoIdx((i) => i + 1);
  };

  return (
    <div className="onboard-wrap">
      <div className="card onboard-card">
        <div className="onboard-dots">
          {cfg.pasos.map((_, i) => (
            <span key={i} className={`onboard-dot${i <= pasoIdx ? " filled" : ""}`} />
          ))}
        </div>
        <div className="onboard-step" key={pasoIdx}>
          <div className="onboard-icon">{paso.icono}</div>
          <h2>{paso.titulo}</h2>
          {paso.texto && <p>{paso.texto}</p>}
        </div>
        <button className="btn" onClick={siguiente}>
          {esUltimo ? cfg.boton_final : cfg.boton_siguiente}
        </button>
      </div>
    </div>
  );
}

export default function LandingAura() {
  // onboarding | upload | analyzing | report | form | done
  const [view, setView] = useState(onboardingActivo ? "onboarding" : "upload");
  const [photo, setPhoto] = useState(null);
  const [consent, setConsent] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState({
    nombre: "", telefono: "", email: "", franja: "Mañanas",
    edad: "", motivacion: "",
  });
  const [barsOn, setBarsOn] = useState(false);
  const [leadWallUnlocked, setLeadWallUnlocked] = useState(false);
  const fileRef = useRef(null);
  const imgB64 = useRef(null);

  const leadWallActive = !!respuesta.lead_wall;

  useEffect(() => {
    capturarUnaVez("portada_vista");
  }, []);

  const mensajesCarga = analisis.mensajes_carga?.length
    ? analisis.mensajes_carga
    : ["Analizando…"];

  useEffect(() => {
    if (view !== "analyzing" || encuestaEspera?.activo) return;
    const tick = setInterval(() => setMsgIdx((i) => (i + 1) % mensajesCarga.length), 1900);
    return () => clearInterval(tick);
  }, [view]);

  useEffect(() => {
    if (view === "report") {
      setBarsOn(false);
      const tmr = setTimeout(() => setBarsOn(true), 150);
      capturarUnaVez("informe_parcial_visto");
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
      // El análisis debe resolverse en máx. ANALYSIS_TIMEOUT_MS: si el
      // webhook tarda más, abortamos y lo tratamos como fallo (mismo
      // mensaje que cualquier otro error de red).
      const timeoutCtrl = new AbortController();
      const timeoutId = setTimeout(() => timeoutCtrl.abort(), ANALYSIS_TIMEOUT_MS);
      let response;
      try {
        response = await fetch("/api/analisis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // n8n construye el prompt a partir de `analisis` y valida que
          // `bloques_activos` solo contenga tipos del catálogo fijo
          // (ver n8n-PROMPT-BUILDER.md).
          body: JSON.stringify(body),
          signal: timeoutCtrl.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) throw new Error(`Webhook respondió ${response.status}`);
      const parsed = await response.json();
      if (!parsed.es_valido) {
        setError(parsed.motivo || analisis.rechazo);
        setView("upload");
        return;
      }
      setResult(parsed);
      // Si hay encuesta de espera activa, no saltamos a "report" todavía:
      // se espera a que el usuario la responda (ver botón "Ver mi informe"
      // en la vista "analyzing"), para que el análisis rápido no se la
      // lleve por delante antes de que le dé tiempo a leerla.
      if (!encuestaEspera?.activo) setView("report");
    } catch (e) {
      setError("El análisis no se ha podido completar. Inténtalo de nuevo en unos segundos.");
      setView("upload");
    }
  };

  const submitLead = async () => {
    const campos = respuesta.cta.campos;
    if (campos.includes("nombre") && !lead.nombre.trim()) return;
    if (campos.includes("email") && !EMAIL_RE.test(lead.email.trim())) return;
    if (campos.includes("telefono") && !telefonoValido(lead.telefono)) return;
    if (sending) return;
    setSending(true);
    // La conversión: nunca lleva email/teléfono/nombre como propiedad.
    capturarUnaVez("datos_entregados");
    if (LEAD_WEBHOOK_URL) {
      try {
        await fetch(LEAD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: lead.nombre.trim(),
            email: lead.email.trim(),
            telefono: lead.telefono.trim(),
            franja: lead.franja,
            // Respondidas (opcionalmente) durante la espera del análisis.
            edad: lead.edad.trim(),
            motivacion: lead.motivacion,
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
    // Evento "Lead" a Meta Conversions API (ver api/meta-capi.js). Es un
    // best-effort aparte del webhook de arriba: si Meta no está
    // configurado o falla, no afecta al lead ni al resto del flujo.
    try {
      await fetch("/api/meta-capi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "Lead",
          event_source_url: window.location.href,
          email: lead.email.trim(),
          telefono: lead.telefono.trim(),
          fbp: leerCookie("_fbp") || undefined,
          fbc: leerCookie("_fbc") || undefined,
        }),
      });
    } catch (e) {
      console.error("Error notificando el evento Lead a Meta:", e);
    }
    setSending(false);
    if (leadWallActive) {
      setLeadWallUnlocked(true);
    } else {
      setView("done");
    }
  };

  const reset = () => {
    setView("upload");
    setPhoto(null);
    imgB64.current = null;
    setResult(null);
    setConsent(false);
    setError(null);
    setLead({ nombre: "", telefono: "", email: "", franja: "Mañanas", edad: "", motivacion: "" });
    setLeadWallUnlocked(false);
  };

  const campos = respuesta.cta.campos;
  const formValido =
    (!campos.includes("nombre") || lead.nombre.trim()) &&
    (!campos.includes("email") || EMAIL_RE.test(lead.email.trim())) &&
    (!campos.includes("telefono") || telefonoValido(lead.telefono));

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


        .gancho { text-align: center; padding: 40px 0 0; max-width: 480px; margin: 0 auto; }
        .gancho h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 30px; color: var(--ink); margin-bottom: 14px; }
        .gancho p { color: var(--ink); font-size: 18px; line-height: 1.6; }

        .onboard-wrap { padding: 52px 0 8px; }
        .onboard-card { max-width: 420px; margin: 0 auto; text-align: center; padding: 36px 28px; }
        .onboard-dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 28px; }
        .onboard-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); transition: background .2s; }
        .onboard-dot.filled { background: var(--sage); }
        .onboard-step { animation: qualIn .28s ease; min-height: 180px; display: flex; flex-direction: column; justify-content: center; }
        @media (prefers-reduced-motion: reduce) { .onboard-step { animation: none; } }
        .onboard-icon {
          width: 64px; height: 64px; border-radius: 50%; background: var(--sage-soft);
          display: flex; align-items: center; justify-content: center; font-size: 28px;
          margin: 0 auto 18px;
        }
        .onboard-step h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 30px; line-height: 1.25; }
        .onboard-step p { color: var(--ink-soft); font-size: 14.5px; line-height: 1.55; margin-top: 8px; }

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

        .camera-wrap { text-align: center; }
        .camera-frame {
          position: relative; width: 100%; max-width: 320px; aspect-ratio: 3 / 4;
          margin: 0 auto; border-radius: 18px; overflow: hidden;
          background: #14201A; border: 1px solid var(--line);
        }
        .camera-frame video, .camera-frame img {
          width: 100%; height: 100%; object-fit: cover; display: block; transform: scaleX(-1);
        }
        .camera-idle {
          position: absolute; inset: 0; z-index: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #FDFBF8; text-align: center; padding: 20px;
        }
        .camera-idle-icon { font-size: 32px; opacity: 0.85; }
        .camera-idle-text { font-size: 13px; opacity: 0.8; max-width: 200px; line-height: 1.4; }
        .camera-oval {
          position: absolute; inset: 9% 15%; border-radius: 50% / 58%;
          border: 3px solid rgba(253,251,248,0.85);
          box-shadow: 0 0 0 2000px rgba(20,32,26,0.32);
          pointer-events: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .camera-oval.tone-off {
          border-color: var(--amber);
          box-shadow: 0 0 0 2000px rgba(20,32,26,0.32), 0 0 22px rgba(200,154,75,0.45);
        }
        .camera-oval.tone-centered {
          border-color: var(--sage);
          box-shadow: 0 0 0 2000px rgba(20,32,26,0.32), 0 0 26px rgba(111,191,166,0.6);
        }
        .camera-countdown {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 64px; color: #FDFBF8;
          text-shadow: 0 2px 16px rgba(0,0,0,0.55); pointer-events: none;
        }
        .camera-guide {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: rgba(20,32,26,0.72); color: #FDFBF8;
          font-size: 12.5px; font-weight: 600; padding: 10px 14px;
          text-align: center; line-height: 1.4;
        }
        .camera-trust { font-size: 12px; color: var(--ink-soft); margin: 12px 0 4px; line-height: 1.5; }
        .camera-actions { display: flex; gap: 12px; margin-top: 14px; }
        .camera-actions .btn { margin-top: 0; width: auto; flex: 1; }
        .camera-wrap > .btn { max-width: 320px; }
        .camera-error { text-align: center; padding: 12px 0; }
        .camera-error-msg { font-size: 13.5px; color: var(--ink-soft); margin-bottom: 16px; line-height: 1.5; }
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
        .wait-survey { max-width: 320px; margin: 8px auto 0; text-align: left; }
        .wait-intro { font-family: 'Fraunces', serif; font-size: 17px; text-align: center; margin-bottom: 18px; }

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

        /* Grid en vez de position:absolute: lock-blur y leadwall-overlay
           comparten la misma celda (1/1), así que .lockwrap crece para
           encajar el más alto de los dos sin números mágicos — y el
           formulario nunca tapa el gancho (resumen + primer bloque), que
           vive FUERA de este contenedor. */
        .lockwrap { display: grid; }
        .lock-blur { grid-area: 1 / 1; filter: blur(9px); pointer-events: none; user-select: none; }
        .leadwall-overlay {
          grid-area: 1 / 1; z-index: 5;
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .leadwall-card {
          background: var(--card); border-radius: 20px; border: 1px solid var(--line);
          box-shadow: 0 12px 40px rgba(20,32,26,0.18);
          padding: 26px 24px; max-width: 380px; width: 100%;
        }
        .lock-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: var(--sage-soft); color: var(--sage);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin: 0 auto 16px;
        }
        .lock-msg {
          font-family: 'Fraunces', serif; font-size: 19px; font-weight: 500; color: var(--ink);
          text-align: center; margin-bottom: 22px; line-height: 1.4;
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

        .qual-section { margin-top: 26px; }
        /* Mismo tratamiento visual que .cta-block: fondo verde oscuro,
           letras blancas — es el único cuadro final, no hay uno genérico
           de "reserva tu valoración" al lado. */
        .qual-card {
          background: var(--sage-deep); color: #F2EFE9; border: none; border-radius: 20px;
          padding: 28px 24px; box-shadow: 0 2px 24px rgba(34,49,43,0.08);
        }
        .qual-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 22px; text-align: center; margin-bottom: 6px; }
        .qual-subtitle { font-size: 13.5px; opacity: 0.85; line-height: 1.5; text-align: center; margin-bottom: 20px; }
        .qual-progress-track { height: 5px; background: rgba(255,255,255,0.22); border-radius: 100px; overflow: hidden; }
        .qual-progress-bar { height: 100%; background: var(--blush); border-radius: 100px; transition: width .3s ease; }
        .qual-step { margin-top: 20px; animation: qualIn .28s ease; }
        @keyframes qualIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .qual-step { animation: none; } }
        .qual-question { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; line-height: 1.35; }
        .qual-opcional { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; opacity: 0.7; }
        .qual-anchor {
          margin-top: 10px; font-size: 12.5px; line-height: 1.5;
          background: rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 14px;
        }
        .qual-options { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .qual-option {
          font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink);
          background: #FDFCFA; border: 1.5px solid transparent; border-radius: 100px;
          padding: 10px 16px; cursor: pointer; transition: border-color .15s, background .15s, color .15s;
        }
        .qual-option:hover { border-color: var(--blush); }
        .qual-option.selected { background: var(--blush); border-color: var(--blush); color: var(--sage-deep); }
        .qual-text-wrap { margin-top: 16px; }
        .qual-text-input {
          width: 100%; padding: 13px 16px; border: 1.5px solid transparent;
          border-radius: 12px; font-family: inherit; font-size: 15px; color: var(--ink);
          background: #FDFCFA; outline: none; transition: border-color .2s;
        }
        .qual-text-input:focus { border-color: var(--blush); }
        .qual-suggestions {
          /* Flujo normal (no absolute): así nunca queda flotando encima del
             botón "Siguiente" — en su lugar empuja el layout hacia abajo. */
          margin-top: 6px; max-height: 176px; overflow-y: auto;
          background: var(--card); border: 1px solid var(--line); border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15); list-style: none;
        }
        .qual-suggestion { padding: 11px 16px; font-size: 14px; color: var(--ink); cursor: pointer; }
        .qual-suggestion:hover { background: var(--sage-soft); }
        .qual-nav { display: flex; gap: 12px; margin-top: 24px; }
        .qual-nav .btn { margin-top: 0; }
        .qual-nav .btn.ghost { flex: 0 0 auto; width: auto; padding-left: 20px; padding-right: 20px; border-color: rgba(255,255,255,0.5); color: #F2EFE9; }
        .qual-nav .btn:not(.ghost) { flex: 1; background: var(--blush); color: var(--sage-deep); }
        .qual-nav .btn:not(.ghost):hover:not(:disabled) { background: #F0DACB; }
        .qual-result { text-align: center; }
        .qual-result .card-label { color: rgba(255,255,255,0.75); }
        .qual-result .price-range { color: #FDFBF8; }
        .qual-result .price-disclaimer { background: rgba(255,255,255,0.14); color: #F2EFE9; }

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
        {view === "onboarding" && marca.gancho && (
          <div className="gancho">
            {marca.gancho.titulo && <h2>{marca.gancho.titulo}</h2>}
            <p>{renderBold(marca.gancho.texto)}</p>
          </div>
        )}

        {view === "onboarding" && (
          <Onboarding cfg={onboarding} onFinish={() => setView("upload")} />
        )}

        {view === "upload" && (
          <>
            <div className="hero">
              <div className="eyebrow">{hero.eyebrow}</div>
              <h1>{renderEmphasis(hero.titulo)}</h1>
              <p className="sub">{hero.subtitulo}</p>
            </div>

            <div className="uploader">
              {!photo ? (
                capturaModo === "camara" ? (
                  <CameraCapture onFile={onFile} />
                ) : (
                  <div className="dropzone" onClick={() => fileRef.current?.click()}>
                    <div className="dz-icon">✦</div>
                    <div className="dz-title">{t.dropzone_titulo}</div>
                    <div className="dz-hint">{t.dropzone_hint}</div>
                  </div>
                )
              ) : (
                <div className="preview">
                  <img className="ph-no-capture" src={photo} alt="Tu foto" />
                  <div className="meta">
                    <b>{t.preview_titulo}</b>
                    <span>{t.preview_nota}</span>
                    <div style={{ marginTop: 6 }}>
                      <button
                        className="link-btn"
                        onClick={() =>
                          capturaModo === "camara" ? setPhoto(null) : fileRef.current?.click()
                        }
                      >
                        {t.cambiar_foto}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {capturaModo === "galeria" && (
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: "none" }}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              )}

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
              <img className="ph-no-capture" src={photo} alt="Analizando tu foto" />
              <div className="scan-grid" />
              <div className="scan-line" />
            </div>
            {encuestaEspera?.activo ? (
              <div className="wait-survey">
                <p className="wait-intro">{encuestaEspera.intro}</p>
                <div className="field">
                  <label htmlFor="edad">{encuestaEspera.edad.pregunta}</label>
                  <input
                    id="edad"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="120"
                    placeholder={encuestaEspera.edad.placeholder}
                    value={lead.edad}
                    onChange={(e) => setLead({ ...lead, edad: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="motivacion">{encuestaEspera.motivacion.pregunta}</label>
                  <select
                    id="motivacion"
                    value={lead.motivacion}
                    onChange={(e) => setLead({ ...lead, motivacion: e.target.value })}
                  >
                    <option value="" disabled>Elige una opción</option>
                    {encuestaEspera.motivacion.opciones.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                {result && (
                  <button
                    className="btn"
                    disabled={!(lead.edad.trim() && lead.motivacion)}
                    onClick={() => {
                      // Nunca la edad exacta como propiedad, solo el tramo.
                      capturarUnaVez("encuesta_completada", {
                        motivacion: lead.motivacion,
                        edad_tramo: tramoEdad(lead.edad),
                      });
                      setView("report");
                    }}
                  >
                    {encuestaEspera.boton_ver_informe}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="scan-msg">{mensajesCarga[msgIdx]}</div>
                <div className="scan-sub">{t.scan_sub}</div>
              </>
            )}
          </div>
        )}

        {view === "report" && result && (
          <>
            <div className="report-head">
              <img className="thumb ph-no-capture" src={photo} alt="" />
              <h2>{t.informe_titulo}</h2>
              <p>{result.resumen}</p>
            </div>

            {leadWallActive && !leadWallUnlocked ? (
              <>
                {/* El primer bloque se ve sin bloquear (gancho, junto al
                    resumen); el resto queda borroso — con el formulario
                    encima, pero solo tapando ESTA sección, no toda la
                    pantalla, para que el gancho se pueda seguir leyendo. */}
                {result.bloques?.[0] && renderBloque(result.bloques[0], 0, barsOn)}
                {result.bloques?.length > 1 && (
                  <div className="lockwrap">
                    <div className="lock-blur">
                      {result.bloques.slice(1).map((b, i) => renderBloque(b, i + 1, barsOn))}
                    </div>
                    <div className="leadwall-overlay">
                      <div className="leadwall-card">
                        <div className="lock-icon">🔒</div>
                        <div className="lock-msg">Deja tus datos para ver tu informe completo</div>
                        <LeadFormFields campos={campos} lead={lead} setLead={setLead} />
                        <button className="btn" disabled={!formValido || sending} onClick={submitLead}>
                          {sending ? t.form_boton_enviando : t.form_boton}
                        </button>
                        {campos.includes("email") && (
                          <p className="privacy-note">Te enviaremos tu informe completo a este email.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              result.bloques?.map((b, i) => renderBloque(b, i, barsOn))
            )}

            {/* Si hay formulario de cualificación, ES el CTA final — no
                dupliques con el bloque genérico de "reserva tu valoración". */}
            {(!leadWallActive || leadWallUnlocked) && !cualificacion?.activo && (
              <div className="cta-block">
                <h3>{respuesta.cta.titulo}</h3>
                <p>{respuesta.cta.texto}</p>
                <button
                  className="btn"
                  onClick={() => (leadWallActive ? setView("done") : setView("form"))}
                >
                  {respuesta.cta.texto_boton}
                </button>
              </div>
            )}

            {leadWallActive && leadWallUnlocked && cualificacion?.activo && (
              <Cualificacion cfg={cualificacion} marca={marca} lead={lead} />
            )}

            <div className="again">
              <button className="link-btn" onClick={reset}>{t.analizar_otra}</button>
            </div>
          </>
        )}

        {view === "form" && (
          <div className="card form-card">
            <h2>{t.form_titulo}</h2>
            <p className="lead-sub">{t.form_subtitulo}</p>
            <LeadFormFields campos={campos} lead={lead} setLead={setLead} />
            <button className="btn" disabled={!formValido || sending} onClick={submitLead}>
              {sending ? t.form_boton_enviando : t.form_boton}
            </button>
            {campos.includes("email") && (
              <p className="privacy-note">Te enviaremos tu informe completo a este email.</p>
            )}
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
              Hemos enviado tu solicitud.
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

        <footer>{footer}</footer>
      </div>
    </div>
  );
}
