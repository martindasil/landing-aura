// ─────────────────────────────────────────────────────────────
// Config de cliente DEMO: reformas de jardín (empresa ficticia)
// Sirve para probar los bloques nuevos (checklist, propuesta,
// horquilla_precio, imagen_despues) con un caso distinto al de
// la clínica. Los precios de datos_negocio son un EJEMPLO A
// SUSTITUIR por la tarifa real del cliente antes de producción.
// ─────────────────────────────────────────────────────────────

export default {
  marca: {
    nombre: "Jardín Demo",

    // Las claves de color son las mismas que usa el CSS del componente
    // (var(--sage), var(--clay)...) independientemente del cliente;
    // aquí solo cambian los valores hexadecimales, no los nombres.
    colores: {
      bg: "#F6F5EE",
      card: "#FFFFFF",
      ink: "#26301F",
      inkSoft: "#5E6650",
      sage: "#5C7A3B",
      sageDeep: "#3F5629",
      sageSoft: "#EEF1E4",
      blush: "#E4D2A8",
      amber: "#C9902F",
      clay: "#A85A34",
      line: "#E1DECF",
    },

    hero: {
      eyebrow: "Reformas de jardín · Propuesta con IA",
      titulo: "Descubre lo que tu jardín *necesita* en 30 segundos",
      subtitulo:
        "Sube una foto de tu jardín o patio y nuestra IA te preparará una propuesta " +
        "orientativa con las mejoras posibles y un rango de precio estimado.",
    },

    textos_upload: {
      dropzone_titulo: "Sube una foto de tu jardín o patio",
      dropzone_hint: "A plena luz del día y mostrando el espacio completo si es posible",
      preview_titulo: "Foto lista para analizar",
      preview_nota: "Se procesa de forma segura y no se almacena.",
      cambiar_foto: "Cambiar foto",
      boton_analizar: "Analizar mi jardín →",
      nota_privacidad: "Análisis gratuito y sin compromiso · Resultados al instante",
      scan_sub: "Esto suele tardar unos 15 segundos",
      informe_titulo: "Tu propuesta de jardín",
      analizar_otra: "Analizar otra foto",
      form_titulo: "Reserva tu visita técnica",
      form_subtitulo: "Déjanos tus datos y te llamamos para confirmar el presupuesto. Sin compromiso.",
      form_boton: "Enviar y reservar",
      form_boton_enviando: "Enviando…",
      volver_informe: "← Volver a la propuesta",
      done_saludo: "¡Listo",
    },

    footer:
      "Propuesta orientativa generada con inteligencia artificial. " +
      "El presupuesto final se confirma tras una visita técnica.",
  },

  analisis: {
    objeto: "jardín, patio o espacio exterior",
    rechazo:
      "No hemos detectado un jardín, patio o espacio exterior en la foto. " +
      "Prueba con una foto que muestre el espacio completo, a plena luz.",
    criterios: [
      { nombre: "Césped y vegetación", que_mirar: "estado, densidad y zonas peladas o secas" },
      { nombre: "Poda y estructura", que_mirar: "setos, árboles y arbustos: forma y mantenimiento" },
      { nombre: "Riego", que_mirar: "presencia o ausencia de sistema de riego visible" },
      { nombre: "Pavimentos y caminos", que_mirar: "estado de suelos, caminos y zonas de paso" },
      { nombre: "Zonas de descanso", que_mirar: "potencial para terraza, chill-out o comedor exterior" },
      { nombre: "Orden y limpieza general", que_mirar: "acumulación de hojas, maleza o desorden" },
    ],
    tono:
      "Entusiasta, profesional y constructivo. No uses lenguaje alarmista ni palabras " +
      "como \"desastre\" o \"abandonado\": habla en términos de \"potencial de mejora\". " +
      "Es una propuesta orientativa, el diagnóstico final se confirma en visita técnica.",

    // ⚠️ EJEMPLO A SUSTITUIR por la tarifa real del cliente antes de producción.
    // Estos precios son inventados únicamente para probar el bloque horquilla_precio.
    datos_negocio: {
      aviso: "⚠️ TARIFA DE EJEMPLO — sustituir por los precios reales del cliente",
      moneda: "EUR",
      tarifas_m2: [
        { servicio: "Diseño y planificación", precio_min_m2: 8, precio_max_m2: 15 },
        { servicio: "Instalación de césped natural", precio_min_m2: 12, precio_max_m2: 22 },
        { servicio: "Sistema de riego automático", precio_min_m2: 18, precio_max_m2: 30 },
        { servicio: "Pavimentación y zonas de paso", precio_min_m2: 35, precio_max_m2: 60 },
      ],
    },

    mensajes_carga: [
      "Detectando los límites del jardín…",
      "Evaluando césped y vegetación…",
      "Analizando estructuras y caminos…",
      "Calculando potencial de mejora…",
      "Preparando tu propuesta personalizada…",
    ],
  },

  respuesta: {
    bloques: ["checklist", "propuesta", "horquilla_precio"],
    imagen_despues: {
      prompt_edicion:
        "Genera una versión mejorada de esta MISMA foto de jardín, manteniendo " +
        "exactamente la estructura, perspectiva, encuadre y elementos fijos " +
        "(paredes, vallas, construcciones) de la imagen original. Aplica solo " +
        "las mejoras de jardinería propuestas (césped, poda, orden). No inventes " +
        "una ubicación distinta ni cambies el ángulo de cámara.",
      etiqueta_legal: "Simulación ilustrativa — el resultado real puede variar",
    },
    cta: {
      titulo: "¿Quieres un presupuesto exacto?",
      texto:
        "Reserva una visita técnica gratuita con nuestro equipo. " +
        "Confirmaremos la propuesta y el precio final in situ, sin compromiso.",
      texto_boton: "Quiero mi presupuesto gratuito",
      campos: ["nombre", "telefono", "franja"],
    },
  },
};
