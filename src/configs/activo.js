// ─────────────────────────────────────────────────────────────
// Cliente activo para este despliegue.
// Se selecciona con la variable de entorno VITE_CLIENTE (ver
// .env.example). Es el ÚNICO sitio que hay que tocar para añadir
// un cliente nuevo al mapa — el componente no contiene ninguna
// lógica de negocio.
//
// Los configs se importan de forma estática a propósito: Vite no
// resuelve bien un import() dinámico construido con una variable
// (import(`./${nombre}.js`)), así que registramos aquí cada cliente
// disponible y elegimos entre ellos ya en memoria.
// ─────────────────────────────────────────────────────────────

import clinicaAura from "./clinica-aura.js";
import jardinDemo from "./jardin-demo.js";

const CLIENTES = {
  "clinica-aura": clinicaAura,
  "jardin-demo": jardinDemo,
};

const DEFECTO = "clinica-aura";
const solicitado = import.meta.env.VITE_CLIENTE;

let clienteId = DEFECTO;
if (solicitado) {
  if (CLIENTES[solicitado]) {
    clienteId = solicitado;
  } else {
    console.warn(
      `[configs/activo] VITE_CLIENTE="${solicitado}" no reconocido. ` +
      `Valores válidos: ${Object.keys(CLIENTES).join(", ")}. Usando "${DEFECTO}" por defecto.`
    );
  }
}

export default CLIENTES[clienteId];
