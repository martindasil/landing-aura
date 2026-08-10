// PostHog: analítica de producto + session replay.
//
// Capa independiente del Pixel de Meta / api/meta-capi.js — no comparte
// nada con ellos a propósito.
//
// PRIVACIDAD (crítico): la landing promete al usuario que su foto no se
// almacena. El session replay JAMÁS debe capturar la foto capturada, el
// vídeo de la cámara en vivo, ni los datos de contacto. Ver el uso de la
// clase "ph-no-capture" en src/App.jsx sobre cada <img>/<video> que
// pueda mostrar la foto — esa clase la reconoce posthog-js de forma
// nativa (confirmado leyendo node_modules/posthog-js/dist/array.full.js
// directamente, no solo la documentación) y bloquea el elemento entero
// ANTES de serializarlo: el src (aunque sea un data:URI en base64 con la
// foto embebida) nunca llega a construirse en la grabación. El
// enmascarado de texto (maskTextSelector) NO habría sido suficiente aquí
// porque no actúa sobre atributos como src, solo sobre contenido de
// texto — por eso se usa bloqueo, no enmascarado, para las imágenes.
//
// Los campos de formulario (nombre, email, teléfono, y los de
// cualificación) ya quedan cubiertos por maskAllInputs: true, que es el
// comportamiento por defecto de posthog-js para cualquier <input>/
// <select>/<textarea> — se deja explícito aquí en vez de confiar en el
// valor por defecto silenciosamente.
//
// Grabación de canvas: NO se activa (recordCanvas no se toca, por
// defecto es false). En este proyecto tampoco habría nada que grabar:
// los dos únicos <canvas> del código (prepareImage en App.jsx y
// capture() en CameraCapture) se crean con document.createElement,
// nunca se insertan en el DOM y se descartan justo después de leer su
// dataURL — no son elementos visibles que la grabación de canvas pueda
// capturar aunque estuviera activada.

import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

export function initPosthog() {
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    enable_heatmaps: true,
    // Por defecto es `undefined` y en ese caso el SDK hereda el ajuste
    // remoto del proyecto — que hoy en PostHog está en `true`. Se fuerza
    // aquí a `false` para no depender de un toggle de la UI de PostHog:
    // si algún log de consola (p. ej. un catch de depuración) incluyera
    // el dataURL de la foto, no debe poder acabar grabado en el replay.
    enable_recording_console_log: false,
    session_recording: {
      // Explícito aunque ya sea el valor por defecto: cubre nombre,
      // email, teléfono, el input de municipio de la cualificación, y
      // los <select> (franja, motivación de la encuesta de espera).
      maskAllInputs: true,
      // Explícito aunque ya sea el valor por defecto: nunca grabar
      // canvas (no hay ninguno persistente en el DOM, ver nota arriba).
      recordCanvas: false,
    },
  });
}

// ── Guard "una vez por sesión" ─────────────────────────────────────────
// sessionStorage (no un simple Set en memoria) para que sobreviva a una
// recarga de página dentro de la misma pestaña/sesión, no solo a
// re-renders — un refresco a mitad de embudo no debe volver a disparar
// portada_vista, por ejemplo.
const PREFIJO_GUARD = "ph_evt_";

function yaDisparado(clave) {
  try {
    return sessionStorage.getItem(PREFIJO_GUARD + clave) === "1";
  } catch {
    return false; // sessionStorage no disponible (p. ej. navegación privada estricta): no bloquea el evento
  }
}

function marcarDisparado(clave) {
  try {
    sessionStorage.setItem(PREFIJO_GUARD + clave, "1");
  } catch {
    // no-op
  }
}

// claveDedup permite diferenciar eventos que comparten event_name pero
// representan pasos distintos (tutorial_paso_completado con paso 1..4:
// cada paso es su propio guard, no "el evento ya se disparó una vez en general").
export function capturarUnaVez(evento, propiedades, claveDedup) {
  const clave = claveDedup || evento;
  if (yaDisparado(clave)) return;
  marcarDisparado(clave);
  if (!POSTHOG_KEY) return;
  posthog.capture(evento, propiedades);
}

// Nunca se manda la edad exacta como propiedad de evento — solo el tramo.
export function tramoEdad(edadStr) {
  const n = parseInt(edadStr, 10);
  if (!Number.isFinite(n) || n < 18) return null;
  if (n <= 29) return "18-29";
  if (n <= 39) return "30-39";
  if (n <= 49) return "40-49";
  if (n <= 59) return "50-59";
  return "60+";
}
