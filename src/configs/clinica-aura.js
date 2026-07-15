// ─────────────────────────────────────────────────────────────
// Config de cliente: Clínica Aura (medicina estética)
// Caso original de la landing, migrado tal cual al nuevo contrato.
// ─────────────────────────────────────────────────────────────

export default {
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
      eyebrow: "Medicina estética · Diagnóstico con IA",
      // *palabra* se renderiza en cursiva y color de acento
      titulo: "Descubre lo que tu piel *necesita* en 30 segundos",
      subtitulo:
        "Sube una foto de tu rostro y nuestra IA te preparará un informe " +
        "personalizado con el estado de tu piel y los tratamientos que mejor te irían.",
    },

    // Microcopy general de la interfaz (no solo del paso de subida,
    // pese al nombre heredado del contrato original)
    textos_upload: {
      dropzone_titulo: "Sube tu foto o hazte un selfie",
      dropzone_hint: "De frente, con buena luz y sin maquillaje si es posible",
      preview_titulo: "Foto lista para analizar",
      preview_nota: "Se procesa de forma segura y no se almacena.",
      cambiar_foto: "Cambiar foto",
      boton_analizar: "Analizar mi piel →",
      nota_privacidad: "Análisis gratuito y sin compromiso · Resultados al instante",
      scan_sub: "Esto suele tardar unos 15 segundos",
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
    cta: {
      titulo: "¿Quieres verlo en persona?",
      // Campo adicional no listado en el contrato mínimo, pero necesario
      // para mantener el bloque de CTA visualmente igual al original.
      texto:
        "Reserva una valoración gratuita con nuestro equipo médico. " +
        "Revisaremos tu informe contigo, sin compromiso.",
      texto_boton: "Quiero mi valoración gratuita",
      campos: ["nombre", "telefono", "franja"],
    },
  },
};
