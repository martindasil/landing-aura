# React + Vite

## Variables de entorno

Copia `.env.example` a `.env` (o `.env.local`) y ajusta:

- `VITE_CLIENTE` — cliente activo (`clinica-aura` o `jardin-demo`), ver
  `src/configs/activo.js`. Por defecto `clinica-aura` si no se define.
- `VITE_WEBHOOK_CUALIFICACION` — opcional. Webhook de n8n que recibe las
  respuestas del formulario de cualificación (bloque al final del informe,
  tras desbloquear el lead-wall). Sin definir, el formulario funciona igual
  y muestra la horquilla de precio al lead, solo que no envía el POST.
- `META_CAPI_ACCESS_TOKEN` — opcional, **solo en Vercel** (nunca en `.env`
  local, y a propósito sin el prefijo `VITE_` para que no llegue al
  navegador). Access token de Meta Conversions API, usado por la función
  serverless `api/meta-capi.js` para mandar los eventos `PageView` y `Lead`
  desde el servidor. Se genera en Events Manager → tu Pixel → Configuración
  → Conversions API. Sin definir, la función no rompe nada, simplemente no
  envía nada a Meta.
- `META_TEST_EVENT_CODE` — opcional, mismo sitio que la anterior. Código de
  "Probar eventos" del Events Manager; con ella definida, cada evento que
  se manda a Meta lleva `test_event_code` para que aparezca en esa
  herramienta (esos eventos no cuentan para optimización). Bórrala para
  volver al modo normal sin tocar código.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — opcionales, mismo
  sitio. Credenciales de Upstash Redis para el límite de peticiones por IP
  de `api/meta-capi.js` (ver más abajo). Sin ellas, ese límite queda
  desactivado — no hay protección real hasta que estén configuradas.

(`WEBHOOK_URL` y `LEAD_WEBHOOK_URL` — análisis de la foto y notificación del
lead-wall — son constantes al principio de `src/App.jsx`, no variables de
entorno; edítalas ahí antes de desplegar.)

En Vercel, define estas mismas variables en Project Settings → Environment
Variables.

## Meta Conversions API

`api/meta-capi.js` es una función serverless de Vercel (se despliega sola,
sin configuración adicional, por la convención del directorio `api/`) que
reenvía eventos a Meta desde el servidor:

- **PageView** — disparado desde el propio `index.html` en cada carga,
  junto al Pixel del navegador, compartiendo `event_id` con él para que
  Meta deduplique y no lo cuente dos veces.
- **Lead** — disparado desde `submitLead()` en `src/App.jsx` al enviar el
  formulario del lead-wall, con el email y teléfono ya capturados. El
  hasheo (SHA256) y la normalización a formato E.164 ocurren dentro de la
  función serverless — el frontend nunca hashea ni conoce el access token.

Ambos leen las cookies `_fbp`/`_fbc` del navegador y las mandan en texto
plano en `user_data` (nunca se hashean — no son identificadores personales,
solo hashea `email`/`telefono`). Si `_fbc` no existe (no hubo `fbclid` en
la URL), se omite el campo por completo.

Ambos son best-effort respecto a Meta: si `META_CAPI_ACCESS_TOKEN` no está
definido o Meta rechaza el evento, no se rompe ningún flujo de la web.

**CORS**: el endpoint valida la cabecera `Origin` contra una lista blanca
(`https://www.landingaura.com` + previews de Vercel de este proyecto,
`https://landing-aura-*.vercel.app`) y responde `403` a cualquier otro
origen, incluida la petición `OPTIONS` de preflight.

**Límite de peticiones**: máximo 5 por IP cada 10 minutos, vía Upstash
Redis (`api/_lib/rateLimit.js`, módulo aislado a propósito para poder
cambiar de almacén sin tocar el resto). Sin `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` configuradas, no bloquea nada — un contador en
memoria de la función serverless no serviría de protección real, porque no
sobrevive de forma fiable entre invocaciones en Vercel.

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
