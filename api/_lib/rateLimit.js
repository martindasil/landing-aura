// Límite de peticiones por IP para api/meta-capi.js.
//
// Implementado con Upstash Redis (HTTP/REST, sin conexiones persistentes —
// encaja con el modelo serverless) porque el estado en memoria de una
// función de Vercel NO sobrevive de forma fiable entre invocaciones:
// Vercel puede levantar varias instancias concurrentes con memoria
// aislada entre sí, y las recicla (cold start) tras inactividad o en
// cada despliegue. Un contador en memoria daría una falsa sensación de
// protección, no protección real.
//
// Requiere UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (se generan
// solas si conectas la integración "Upstash for Redis" / "Vercel KV"
// desde el marketplace de Vercel, o las creas a mano en upstash.com). Sin
// ellas configuradas, checkRateLimit no bloquea nada — deja pasar todas
// las peticiones y lo indica explícitamente con `active: false`, para no
// dar una falsa sensación de que hay protección cuando no la hay.
//
// Aislado en su propio módulo a propósito: para cambiar de Upstash a otro
// almacén más adelante, solo hay que tocar este fichero.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const VENTANA = "10 m";
const MAX_PETICIONES = 5;

let limiter = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(MAX_PETICIONES, VENTANA),
    prefix: "meta-capi",
  });
}

// Devuelve { limited, active }:
// - active: false  -> Upstash no está configurado (o falló al consultarlo);
//   no se ha comprobado nada de verdad, así que no se bloquea nada.
// - active: true, limited: true/false -> comprobación real contra Redis.
//
// Un fallo de Upstash (red caída, credenciales inválidas, timeout...) NO
// debe tumbar la petición completa — se trata igual que "no configurado":
// se deja pasar y se registra el error, en vez de propagar la excepción.
export async function checkRateLimit(ip) {
  if (!limiter) {
    return { limited: false, active: false };
  }
  try {
    const { success } = await limiter.limit(ip || "sin-ip");
    return { limited: !success, active: true };
  } catch (e) {
    console.error("Error consultando el límite de peticiones en Upstash:", e);
    return { limited: false, active: false };
  }
}
