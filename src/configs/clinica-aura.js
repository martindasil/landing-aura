// ─────────────────────────────────────────────────────────────
// Config de cliente: Clínica Aura (medicina estética)
// Caso original de la landing, migrado tal cual al nuevo contrato.
// ─────────────────────────────────────────────────────────────

export default {
  // "camara": captura en vivo con la cámara frontal (getUserMedia).
  // "galeria": selector de archivo tradicional.
  captura: "camara",

  // Tutorial de bienvenida: se muestra ANTES de la vista de subida/cámara,
  // así que el permiso de cámara nunca se pide antes de que el usuario
  // sepa para qué es. Un paso por pantalla, botón "Siguiente" hasta el
  // último, que usa boton_final y lleva a la vista de captura.
  onboarding: {
    activo: true,
    boton_siguiente: "Siguiente",
    boton_final: "Empezar",
    pasos: [
      {
        icono: "📸",
        titulo: "Te haces una foto",
        texto: "Te haces una foto en el momento con la cámara del móvil, de frente y con buena luz.",
      },
      {
        icono: "🔎",
        titulo: "Analizamos tu piel",
        texto: "En unos segundos evaluamos tu rostro y preparamos tu informe.",
      },
      {
        icono: "📋",
        titulo: "Recibes tu informe",
        texto: "Verás un primer adelanto de tu informe personalizado con el estado de tu piel.",
      },
      {
        icono: "📞",
        titulo: "Te contactamos",
        texto: "Nos dejas tus datos para enviarte el informe completo y que la clínica se ponga en contacto contigo.",
      },
    ],
  },

  marca: {
    nombre: "Clínica Aura",

    colores: {
      bg: "#FBF8F4",
      card: "#FFFFFF",
      ink: "#22312B",
      inkSoft: "#5C6B63",
      sage: "#3E6B5C",
      sageDeep: "#2C5044",
      sageSoft: "#EDF3F0",
      blush: "#EBCDBB",
      amber: "#C89A4B",
      clay: "#B96B4F",
      line: "#E7DFD5",
    },

    hero: {
      eyebrow: "Medicina estética · Diagnóstico personalizado",
      // *palabra* se renderiza en cursiva y color de acento
      titulo: "Descubre lo que tu piel *necesita* en 30 segundos",
      subtitulo:
        "Escanea tu rostro y te prepararemos un informe " +
        "personalizado con el estado de tu piel y los tratamientos que mejor te irían.",
    },

    // Microcopy general de la interfaz (no solo del paso de subida,
    // pese al nombre heredado del contrato original)
    textos_upload: {
      dropzone_titulo: "Sube tu foto o hazte un selfie",
      dropzone_hint: "De frente, con buena luz y sin maquillaje si es posible",
      preview_titulo: "Foto lista para analizar",
      preview_nota: "Tu foto se analiza al momento y no se almacena en ningún servidor.",
      cambiar_foto: "Cambiar foto",
      boton_analizar: "Analizar mi piel →",
      nota_privacidad: "Análisis gratuito y sin compromiso · Resultados al instante",
      scan_sub: "Esto tarda solo unos segundos",
      informe_titulo: "Tu informe de piel",
      analizar_otra: "Analizar otra foto",
      form_titulo: "Reserva tu valoración",
      form_subtitulo: "Déjanos tus datos y te llamamos para darte cita. Sin compromiso.",
      form_boton: "Enviar y reservar",
      form_boton_enviando: "Enviando…",
      volver_informe: "← Volver al informe",
      done_saludo: "¡Listo",
    },

    footer:
      "Análisis orientativo generado con inteligencia artificial. " +
      "No constituye un diagnóstico médico.",
  },

  analisis: {
    objeto: "rostro",
    rechazo:
      "No hemos detectado un rostro en la foto. Prueba con una foto de frente y con buena luz.",
    criterios: [
      { nombre: "Luminosidad", que_mirar: "brillo y viveza general de la piel" },
      { nombre: "Hidratación", que_mirar: "signos visibles de sequedad o deshidratación" },
      { nombre: "Textura", que_mirar: "uniformidad, poros y suavidad de la superficie" },
      { nombre: "Líneas de expresión", que_mirar: "arrugas dinámicas y estáticas" },
      { nombre: "Tono y uniformidad", que_mirar: "manchas, rojeces y homogeneidad del tono" },
      { nombre: "Contorno de ojos", que_mirar: "bolsas, ojeras y flacidez perioculares" },
    ],
    tono:
      "Cálido, respetuoso y profesional. Nunca uses lenguaje duro ni palabras como " +
      "\"defecto\" o \"problema\": habla de \"oportunidades de mejora\". Destaca siempre " +
      "lo positivo además de lo mejorable. Es un análisis orientativo, no un diagnóstico médico.",
    datos_negocio: {},
    mensajes_carga: [
      "Mapeando zonas faciales…",
      "Evaluando luminosidad y tono…",
      "Analizando textura e hidratación…",
      "Midiendo líneas de expresión…",
      "Preparando tu informe personalizado…",
    ],
  },

  respuesta: {
    bloques: ["puntuaciones", "fortalezas", "recomendaciones"],
    imagen_despues: null,
    lead_wall: true,
    cta: {
      titulo: "¿Quieres verlo en persona?",
      // Campo adicional no listado en el contrato mínimo, pero necesario
      // para mantener el bloque de CTA visualmente igual al original.
      texto:
        "Reserva una valoración gratuita con nuestro equipo médico. " +
        "Revisaremos tu informe contigo, sin compromiso.",
      texto_boton: "Quiero mi valoración gratuita",
      campos: ["nombre", "email", "telefono", "franja"],
    },
  },

  // Formulario de cualificación: se muestra DESPUÉS de desbloquear el
  // informe (nunca antes), como bloque final. Sirve para priorizar leads
  // antes de llamarlos y, a cambio, le enseña al lead una horquilla de
  // precio orientativa. Todo el copy/opciones/pesos vive aquí — el
  // componente Cualificacion de App.jsx no tiene ningún texto de negocio.
  cualificacion: {
    activo: true,
    titulo: "Calcula tu presupuesto orientativo",
    subtitulo: "Responde 6 preguntas y te damos una horquilla de precio para tu caso",
    anclaje_precio:
      "Una sesión de bótox va de 180 a 350 €. El ácido hialurónico, desde 340 € " +
      "por vial. Los tratamientos de aparatología facial arrancan sobre los 120 €.",
    boton_siguiente: "Siguiente",
    boton_atras: "← Atrás",
    boton_enviar: "Ver mi horquilla de precio",
    boton_enviando: "Calculando…",
    disclaimer: "Orientativo. El presupuesto exacto se confirma en una valoración presencial.",

    // Zona de la clínica: Sant Cugat del Vallès y municipios del entorno
    // (Vallès Occidental / área metropolitana de Barcelona).
    municipios: [
      "Sant Cugat del Vallès", "Barcelona", "Cerdanyola del Vallès", "Rubí",
      "Sant Quirze del Vallès", "Sabadell", "Terrassa", "Sant Just Desvern",
      "Esplugues de Llobregat", "Molins de Rei", "Barberà del Vallès",
      "Ripollet", "Montcada i Reixac",
    ],

    preguntas: [
      {
        id: "objetivo",
        tipo: "multi",
        pregunta: "¿Qué te gustaría mejorar?",
        opciones: [
          "Arrugas de expresión",
          "Flacidez y óvalo facial",
          "Volumen (labios, pómulos)",
          "Calidad de piel (manchas, poros, marcas)",
          "Ojeras",
        ],
      },
      {
        id: "historial",
        tipo: "single",
        pregunta: "¿Te has hecho antes algún tratamiento estético?",
        opciones: ["Sí, me trato de forma habitual", "Sí, alguna vez", "No, sería la primera vez"],
      },
      {
        id: "recurrencia",
        tipo: "single",
        pregunta: "¿Buscas un resultado puntual o mantenimiento?",
        opciones: [
          "Algo puntual para un momento concreto",
          "Empezar a cuidarme de forma continuada",
          "Aún no lo sé",
        ],
      },
      {
        id: "presupuesto",
        tipo: "single",
        // Pinta cualificacion.anclaje_precio encima de las opciones.
        mostrar_anclaje: true,
        pregunta: "¿Qué presupuesto por sesión te encaja?",
        opciones: ["Hasta 150 €", "150–350 €", "350–700 €", "Más de 700 €"],
      },
      {
        id: "plazo",
        tipo: "single",
        pregunta: "¿Cuándo te gustaría empezar?",
        opciones: ["Este mes", "En 1–3 meses", "Solo me informo"],
        subpregunta: {
          id: "detonante",
          tipo: "single",
          opcional: true,
          mostrar_si: ["Este mes", "En 1–3 meses"],
          pregunta: "¿Hay algún motivo concreto?",
          opciones: ["Boda", "Viaje", "Evento", "Ninguno en especial"],
        },
      },
      {
        id: "municipio",
        tipo: "texto",
        pregunta: "¿En qué municipio te gustaría tratarte?",
        placeholder: "Escribe tu municipio…",
        // Referencia a cualificacion.municipios para el autocompletado.
        autocompletar: "municipios",
      },
    ],

    // Pesos del score parcial (máximo 85; el resto —distancia y renta del
    // municipio— lo añade n8n, por eso el cliente nunca calcula distancia).
    pesos: {
      historial: {
        max: 25,
        valores: { "Sí, me trato de forma habitual": 25, "Sí, alguna vez": 15, "No, sería la primera vez": 5 },
      },
      recurrencia: {
        max: 20,
        valores: {
          "Empezar a cuidarme de forma continuada": 20,
          "Aún no lo sé": 10,
          "Algo puntual para un momento concreto": 5,
        },
      },
      valor_anual: {
        max: 20,
        objetivo: {
          "Arrugas de expresión": 20,
          "Flacidez y óvalo facial": 18,
          "Volumen (labios, pómulos)": 18,
          "Calidad de piel (manchas, poros, marcas)": 10,
          "Ojeras": 12,
        },
        factor_presupuesto: { "Hasta 150 €": 0.5, "150–350 €": 0.8, "350–700 €": 1.0, "Más de 700 €": 1.0 },
      },
      plazo: {
        max: 20,
        valores: { "Este mes": 20, "En 1–3 meses": 12, "Solo me informo": 0 },
        // Si detonante ≠ "Ninguno en especial", se suma con tope en max.
        bonus_detonante: 5,
      },
    },

    // ⚠️ EJEMPLO — horquillas de precio por objetivo, a validar con las
    // tarifas reales del cliente antes de producción. Alimentan el cálculo
    // de la horquilla final que se le enseña al lead tras responder.
    rangos_precio: {
      moneda: "EUR",
      objetivo: {
        "Arrugas de expresión": { min: 180, max: 350 },
        "Flacidez y óvalo facial": { min: 250, max: 600 },
        "Volumen (labios, pómulos)": { min: 340, max: 700 },
        "Calidad de piel (manchas, poros, marcas)": { min: 120, max: 300 },
        "Ojeras": { min: 150, max: 400 },
      },
      presupuesto: {
        "Hasta 150 €": { min: 90, max: 150 },
        "150–350 €": { min: 150, max: 350 },
        "350–700 €": { min: 350, max: 700 },
        "Más de 700 €": { min: 700, max: 1200 },
      },
    },
  },
};
