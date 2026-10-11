import type { Content } from "./en";

export const it: Content = {
  meta: {
    title: "prosed · un correttore che gira sul tuo computer",
    description:
      "prosed sottolinea gli errori di ortografia e grammatica mentre scrivi, nel browser e in ogni app su macOS e Windows. Di default usa un modello locale. Gratuito e open source.",
  },
  header: {
    github: "GitHub",
    language: "Lingua",
    theme: "Tema chiaro",
  },
  hero: {
    tagline: "Un correttore che gira sul tuo computer.",
    repo: "Codice su GitHub",
    download: {
      macos: "Scarica per macOS",
      windows: "Scarica per Windows",
      extension: "Scarica l’estensione",
    },
    other: "Altri download:",
    runs: "Funziona su",
  },
  features: {
    title: "Cosa fa",
    fix: {
      title: "Corregge una parola alla volta",
      body: "Gli errori vengono sottolineati nel campo in cui scrivi. Passa sopra a uno, clicca sulla correzione e cambia solo quella parola. Nient’altro si muove, e Cmd+Z o Ctrl+Z annulla.",
    },
    rewrite: {
      title: "Riformula quando glielo chiedi",
      body: "Seleziona una frase per ottenerne tre versioni. Una versione che perde un numero, un nome o un link non viene mai mostrata.",
    },
    memory: {
      title: "Ricorda cosa hai rifiutato",
      body: "Le parole del tuo dizionario non vengono mai cambiate. Una correzione ignorata una volta non viene più proposta, su nessun sito.",
    },
  },
  machine: {
    title: "Sul tuo computer",
    where: "Dove funziona",
    models: "Quale modello",
    unsupported: "Firefox e Safari: usa l’app desktop.",
    body: "Di default i controlli girano su un modello locale: Ollama, oppure Gemini Nano integrato in Chrome. In entrambi i casi il tuo testo resta sul tuo computer.",
    byok: "Puoi anche aggiungere la tua chiave API di OpenAI, Anthropic, Mistral o di un altro fornitore. I controlli vanno allora direttamente dal tuo computer a quel fornitore.",
    privacy: "Informativa sulla privacy",
    extension: {
      title: "Estensione per il browser",
      body: "Per i browser Chromium come Chrome e Arc. Funziona nelle aree di testo e negli editor avanzati.",
    },
    desktop: {
      title: "App desktop",
      body: "Controlla quello che scrivi in qualsiasi app su macOS e Windows.",
    },
  },
  benchmark: {
    title: "Misurato",
    body: "Valutato con il modello locale predefinito, su un M2 Pro.",
    method: "Come viene misurato",
    basic: "frasi brevi corrette",
    handwritten: "messaggi scritti di fretta corretti",
    rewrites: "varianti di riformulazione mantenute",
    latency: "tempo mediano per controllo",
  },
  vignettes: {
    fix: { before: "Non so ", from: "perchè", to: "perché", after: " non parte." },
    rewrite: {
      sentence: "Sembra che funzioni abbastanza bene per ora.",
      variants: ["Per ora funziona bene.", "Finora funziona bene.", "Al momento funziona bene."],
    },
    memory: {
      dictionary: "Dizionario",
      ignored: "Ignorato su tutti i siti",
      from: "boh",
      to: "non lo so",
    },
  },
  close: "Continua a scrivere. prosed legge con te.",
  footer: {
    license: "Licenza MIT",
    credit: "prosed è nato come fork di {upstream} di Igor Adrov.",
    readme: "README",
    changelog: "Registro delle modifiche",
  },
  demo: {
    label:
      "Esempio animato: prosed sottolinea due errori in un messaggio, li corregge e poi riformula una frase lunga.",
    text: "La versione è quasi pronta, ma aspettiamo perchè manca ancora un pò di test. Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora sembra funzionare abbastanza bene.",
    fixes: [
      { from: "perchè", to: "perché" },
      { from: "pò", to: "po'" },
    ],
    rewrite: {
      sentence:
        "Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora sembra funzionare abbastanza bene.",
      variants: [
        "Abbiamo passato quasi tutta la settimana a provare la nuova funzione di riformulazione con il team di Lione, e per ora funziona bene.",
        "Con il team di Lione abbiamo dedicato quasi tutta la settimana alla nuova funzione di riformulazione, che per ora funziona bene.",
        "La nuova funzione di riformulazione ci ha tenuti occupati quasi tutta la settimana con il team di Lione. Per ora funziona bene.",
      ],
    },
    ui: {
      fixes: "Correzioni",
      acceptAll: "Applica tutto",
      rewrite: "Riformula",
      rewrites: "Riformulazioni",
    },
  },
};
