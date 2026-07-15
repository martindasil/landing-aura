# n8n-PROMPT-BUILDER.md

Instrucciones para adaptar el workflow **"Landing IA — Análisis de piel"** en n8n
al nuevo frontend multi-cliente. Esto NO lo ha tocado el asistente — es una guía
para que lo apliques tú mismo en el nodo **"Preparar petición"**.

No hace falta tocar los demás nodos: el Webhook ya pasa el `body` tal cual, la
llamada a Claude ya reenvía `payload` sin mirar su contenido, y "Parsear informe"
ya hace un parseo genérico del texto de respuesta — ninguno de los tres sabe
nada de "piel" ni de ningún cliente concreto.

---

## 1. Qué cambia en la entrada

El frontend ahora envía esto al webhook (antes solo mandaba `imagen`):

```json
{
  "imagen": "<base64 jpeg>",
  "analisis": {
    "objeto": "rostro",
    "rechazo": "mensaje si la foto no contiene el objeto",
    "criterios": [
      { "nombre": "Luminosidad", "que_mirar": "brillo y viveza general de la piel" }
    ],
    "tono": "instrucciones de tono para la IA",
    "datos_negocio": { "...": "tablas del cliente, ej. precios" },
    "mensajes_carga": ["..."]
  },
  "bloques_activos": ["puntuaciones", "fortalezas", "recomendaciones"]
}
```

`analisis` y `bloques_activos` vienen literalmente de `config.analisis` y
`config.respuesta.bloques` del cliente activo en el frontend — no hace falta
que n8n sepa nada de clínicas ni de jardines, solo lee estos campos genéricos.

`mensajes_carga` no se usa en el prompt (es solo para la animación del
frontend); puedes ignorarlo en n8n.

## 2. Catálogo fijo de tipos de bloque

Este es el contrato de respuesta que la IA debe cumplir **siempre**, sea cual
sea el cliente. Es fijo — no cambia entre clientes, solo cambia qué bloques
están activos (`bloques_activos`).

| tipo               | forma de los datos                                                          |
|---------------------|------------------------------------------------------------------------------|
| `puntuaciones`       | `{ items: [{ nombre, puntuacion: 0-100, observacion }] }`                   |
| `fortalezas`         | `{ items: [string] }`                                                       |
| `recomendaciones`    | `{ items: [{ titulo, zona, beneficio, detalle }] }`                         |
| `checklist`          | `{ items: [{ nombre, estado: "ok"\|"aviso"\|"atencion", observacion }] }`   |
| `propuesta`          | `{ partidas: [{ nombre, descripcion }] }`                                   |
| `horquilla_precio`   | `{ minimo, maximo, moneda, nota }` — **solo** si `datos_negocio` trae precios calculables. Si no hay datos suficientes, la IA no debe incluir este bloque. |
| `imagen_despues`     | **no lo emite el modelo de análisis** — lo añade n8n en una fase posterior (ver §5). No lo incluyas en el prompt. |

Respuesta completa esperada:

```json
{
  "es_valido": true,
  "resumen": "2-3 frases resumiendo el análisis",
  "bloques": [
    { "tipo": "puntuaciones", "items": [...] },
    { "tipo": "fortalezas", "items": [...] }
  ]
}
```

O si la foto no es válida:

```json
{ "es_valido": false, "motivo": "explicación breve y amable" }
```

## 3. Nuevo código para el nodo "Preparar petición"

Sustituye el contenido actual del Code node por esto. **Mantiene el rate
limiting que ya existía** (10/IP/hora, 200/día) al principio, sin tocarlo —
solo cambia la parte de construcción del prompt.

```js
// --- Rate limit: 10 análisis/IP/hora, 200/día global (SIN CAMBIOS) ---
const sd = $getWorkflowStaticData('global');
const ahora = Date.now();
const HORA = 3600000, DIA = 86400000;
const headers = $input.first().json.headers || {};
const ip = (headers['x-forwarded-for'] || headers['x-real-ip'] || 'desconocida').split(',')[0].trim();

sd.porIp = sd.porIp || {};
sd.porIp[ip] = (sd.porIp[ip] || []).filter(t => ahora - t < HORA);
sd.global = (sd.global || []).filter(t => ahora - t < DIA);

if (sd.porIp[ip].length >= 10) throw new Error('Límite por IP alcanzado');
if (sd.global.length >= 200) throw new Error('Límite diario global alcanzado');

sd.porIp[ip].push(ahora);
sd.global.push(ahora);
// --- fin rate limit ---

const body = $input.first().json.body || $input.first().json;
const imagen = body.imagen;
const analisis = body.analisis;
const bloquesActivos = body.bloques_activos;

if (!imagen) {
  throw new Error('Falta el campo imagen (base64) en la petición');
}
if (!analisis || !analisis.objeto) {
  throw new Error('Falta el campo analisis en la petición');
}
if (!Array.isArray(bloquesActivos) || bloquesActivos.length === 0) {
  throw new Error('Falta bloques_activos en la petición');
}

// Catálogo fijo de tipos de bloque válidos — defensa ante llamadas
// manipuladas: cualquier tipo que no esté aquí se descarta sin más.
const CATALOGO_BLOQUES = {
  puntuaciones: {
    instruccion:
      'Un bloque {"tipo":"puntuaciones","items":[{"nombre","puntuacion":0-100,"observacion"}]} ' +
      'con un item por cada criterio de la lista de criterios a evaluar. Puntuaciones realistas, ni infladas ni crueles.',
  },
  fortalezas: {
    instruccion:
      'Un bloque {"tipo":"fortalezas","items":["punto fuerte 1","punto fuerte 2", ...]} con 2-4 aspectos positivos observados.',
  },
  recomendaciones: {
    instruccion:
      'Un bloque {"tipo":"recomendaciones","items":[{"titulo","zona","beneficio","detalle"}]} ' +
      'con 2-3 recomendaciones concretas y accionables basadas en lo observado.',
  },
  checklist: {
    instruccion:
      'Un bloque {"tipo":"checklist","items":[{"nombre","estado":"ok"|"aviso"|"atencion","observacion"}]} ' +
      'con un item por cada criterio de la lista de criterios a evaluar, clasificando su estado.',
  },
  propuesta: {
    instruccion:
      'Un bloque {"tipo":"propuesta","partidas":[{"nombre","descripcion"}]} con 2-4 partidas de trabajo ' +
      'concretas basadas en lo observado en la imagen.',
  },
  horquilla_precio: {
    instruccion:
      'SOLO si puedes calcularlo a partir de "Datos de negocio" (tarifas proporcionadas más abajo) aplicado ' +
      'a lo observado en la imagen: un bloque {"tipo":"horquilla_precio","minimo","maximo","moneda","nota"}. ' +
      'Si no tienes datos de negocio suficientes para estimar un precio, NO incluyas este bloque bajo ningún concepto.',
  },
  // imagen_despues NO se incluye aquí a propósito: no lo genera el modelo de análisis.
};

// Filtra bloques_activos contra el catálogo — ignora cualquier tipo
// desconocido o manipulado que no venga del propio frontend.
const bloquesValidos = bloquesActivos.filter((b) => CATALOGO_BLOQUES[b]);
if (bloquesValidos.length === 0) {
  throw new Error('bloques_activos no contiene ningún tipo reconocido');
}

const criteriosTexto = (analisis.criterios || [])
  .map((c) => `- ${c.nombre}: ${c.que_mirar}`)
  .join('\n');

const datosNegocioTexto = analisis.datos_negocio && Object.keys(analisis.datos_negocio).length
  ? `\nDatos de negocio (úsalos solo si son relevantes para los bloques que generes):\n${JSON.stringify(analisis.datos_negocio, null, 2)}\n`
  : '';

const instruccionesBloques = bloquesValidos
  .map((b) => `- ${CATALOGO_BLOQUES[b].instruccion}`)
  .join('\n');

const lineas = [
  `Eres un sistema de análisis de imágenes para un negocio real. Analiza la foto de ${analisis.objeto} con el siguiente tono: ${analisis.tono}`,
  '',
  `Criterios a evaluar:\n${criteriosTexto}`,
  datosNegocioTexto,
  'Responde SOLO con un objeto JSON válido, sin markdown, sin backticks, sin texto adicional. Estructura exacta:',
  '{',
  '  "es_valido": true,',
  '  "resumen": "2-3 frases resumiendo el análisis",',
  '  "bloques": [',
  '    // incluye EXACTAMENTE estos bloques, en este orden, cada uno con su forma exacta:',
  instruccionesBloques,
  '  ]',
  '}',
  '',
  `Si la imagen NO muestra claramente ${analisis.objeto}, responde solo: ` +
  `{"es_valido": false, "motivo": "explicación breve y amable"}`,
];

return [{
  json: {
    payload: {
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen } },
            { type: 'text', text: lineas.join('\n') }
          ]
        }
      ]
    }
  }
}];
```

## 4. Nodos que NO necesitan cambios

- **Webhook**: ya pasa `body` completo, no sabe ni le importa su forma.
- **Llamada a Claude**: reenvía `$json.payload` tal cual, agnóstico del contenido.
- **Parsear informe**: hace `JSON.parse` genérico del texto de respuesta — el
  cambio de `es_rostro` a `es_valido` y de campos sueltos a `bloques[]` no
  requiere ningún cambio aquí, porque simplemente devuelve lo que la IA
  generó como JSON.
- **Responder**: solo añade la cabecera CORS, no mira el contenido.

## 5. Fase 2 (pendiente, no implementada): `imagen_despues`

Cuando el bloque `imagen_despues` esté activo en `bloques_activos` (lo trae
`config.respuesta.imagen_despues` del cliente, con `prompt_edicion` y
`etiqueta_legal`), habría que:

1. Añadir un nodo nuevo **después** de "Parsear informe" (en paralelo o en
   cadena) que llame a un modelo de generación/edición de imágenes
   (Nano Banana / Gemini 2.5 Flash Image, u otro) pasándole:
   - la imagen original en base64,
   - el `prompt_edicion` que venga en `body.analisis` o en un nuevo campo del
     payload (habría que añadir `imagen_despues: config.respuesta.imagen_despues`
     al payload del frontend, igual que se hace con `analisis`).
2. Subir la imagen resultante a algún storage (S3, Cloudinary, o el propio
   n8n con un binary response) para obtener una `url` pública temporal.
3. Con un nodo **Merge** o **Code**, añadir al array `bloques` de la
   respuesta final un objeto:
   ```json
   { "tipo": "imagen_despues", "url": "https://...", "etiqueta_legal": "Simulación ilustrativa — el resultado real puede variar" }
   ```
   (la `etiqueta_legal` viene del config del cliente, no la inventa la IA).
4. El frontend ya está preparado para esto: si `result.bloques` incluye un
   bloque `tipo: "imagen_despues"` con `url`, lo pinta automáticamente sin
   ningún cambio adicional en el componente.

No implementar esto ahora — es la fase 2 que abordará el usuario más adelante.
