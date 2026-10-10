import type { Content } from "./en";

export const es: Content = {
  meta: {
    title: "prosed · un corrector que funciona en tu ordenador",
    description:
      "prosed subraya las faltas de ortografía y gramática mientras escribes, en el navegador y en cualquier app de macOS y Windows. Por defecto funciona con un modelo local. Gratis y de código abierto.",
  },
  header: {
    github: "GitHub",
    language: "Idioma",
    theme: "Tema claro",
  },
  hero: {
    tagline: "Un corrector que funciona en tu ordenador.",
    repo: "Código en GitHub",
    download: {
      macos: "Descargar para macOS",
      windows: "Descargar para Windows",
      extension: "Descargar la extensión",
    },
    other: "Otras descargas:",
    runs: "Funciona en",
  },
  features: {
    title: "Qué hace",
    fix: {
      title: "Corrige una palabra cada vez",
      body: "Las faltas se subrayan en el mismo campo donde escribes. Pasa el ratón por encima de una, haz clic en la corrección y esa palabra cambia. Nada más cambia, y Cmd+Z o Ctrl+Z lo deshace.",
    },
    rewrite: {
      title: "Reformula cuando se lo pides",
      body: "Selecciona una frase para obtener tres versiones. Una versión que pierde un número, un nombre o un enlace nunca se muestra.",
    },
    memory: {
      title: "Recuerda lo que rechazaste",
      body: "Las palabras de tu diccionario nunca se cambian. Una corrección que ignoras una vez no vuelve a proponerse, en ningún sitio.",
    },
  },
  machine: {
    title: "En tu ordenador",
    where: "Dónde funciona",
    models: "Qué modelo",
    unsupported: "Firefox y Safari: usa la app de escritorio.",
    body: "Por defecto, las comprobaciones usan un modelo local: Ollama o Gemini Nano, integrado en Chrome. En ambos casos, tu texto no sale de tu ordenador.",
    byok: "También puedes añadir tu propia clave de API de OpenAI, Anthropic, Mistral u otro proveedor. Entonces las comprobaciones van directamente de tu ordenador a ese proveedor.",
    privacy: "Política de privacidad",
    extension: {
      title: "Extensión de navegador",
      body: "Para navegadores Chromium como Chrome y Arc. Funciona en áreas de texto y editores enriquecidos.",
    },
    desktop: {
      title: "App de escritorio",
      body: "Revisa lo que escribes en cualquier app de macOS y Windows.",
    },
  },
  benchmark: {
    title: "Medido",
    body: "Evaluado con el modelo local por defecto, en un M2 Pro.",
    method: "Cómo se mide",
    basic: "frases cortas corregidas",
    handwritten: "mensajes escritos deprisa corregidos",
    rewrites: "variantes de reformulación conservadas",
    latency: "tiempo mediano por comprobación",
  },
  vignettes: {
    fix: { before: "Vamos ", from: "haber", to: "a ver", after: " qué pasa." },
    rewrite: {
      sentence: "Parece que funciona bastante bien por ahora.",
      variants: [
        "Por ahora funciona bien.",
        "De momento, funciona bien.",
        "Hasta ahora funciona bien.",
      ],
    },
    memory: {
      dictionary: "Diccionario",
      ignored: "Ignorado en todos los sitios",
      from: "finde",
      to: "fin de semana",
    },
  },
  close: "Sigue escribiendo. prosed lee contigo.",
  footer: {
    license: "Licencia MIT",
    credit: "prosed empezó como un fork de {upstream}, de Igor Adrov.",
    readme: "README",
    changelog: "Registro de cambios",
  },
  demo: {
    label:
      "Ejemplo animado: prosed subraya dos errores en un mensaje, los corrige y luego reformula una frase larga.",
    text: "Creo que la versión esta lista, ya hemos echo todas las pruebas. Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento parece funcionar bastante bien.",
    fixes: [
      { from: "esta", to: "está" },
      { from: "echo", to: "hecho" },
    ],
    rewrite: {
      sentence:
        "Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento parece funcionar bastante bien.",
      variants: [
        "Pasamos casi toda la semana probando la nueva función de reformulación con el equipo de Lyon, y de momento funciona bien.",
        "Con el equipo de Lyon, dedicamos casi toda la semana a probar la nueva función de reformulación, que de momento funciona bien.",
        "La nueva función de reformulación nos ocupó casi toda la semana de pruebas con el equipo de Lyon. De momento, funciona bien.",
      ],
    },
    ui: {
      fixes: "Correcciones",
      acceptAll: "Aplicar todo",
      rewrite: "Reformular",
      rewrites: "Reformulaciones",
    },
  },
};
