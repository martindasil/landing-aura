# React + Vite

## Variables de entorno

Copia `.env.example` a `.env` (o `.env.local`) y ajusta:

- `VITE_CLIENTE` — cliente activo (`clinica-aura` o `jardin-demo`), ver
  `src/configs/activo.js`. Por defecto `clinica-aura` si no se define.
- `VITE_WEBHOOK_CUALIFICACION` — opcional. Webhook de n8n que recibe las
  respuestas del formulario de cualificación (bloque al final del informe,
  tras desbloquear el lead-wall). Sin definir, el formulario funciona igual
  y muestra la horquilla de precio al lead, solo que no envía el POST.

(`WEBHOOK_URL` y `LEAD_WEBHOOK_URL` — análisis de la foto y notificación del
lead-wall — son constantes al principio de `src/App.jsx`, no variables de
entorno; edítalas ahí antes de desplegar.)

En Vercel, define estas mismas variables en Project Settings → Environment
Variables.

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
