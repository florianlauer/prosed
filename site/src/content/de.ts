import type { Content } from "./en";

export const de: Content = {
  meta: {
    title: "prosed · eine Rechtschreibprüfung, die auf Ihrem Rechner läuft",
    description:
      "prosed unterstreicht Rechtschreib- und Grammatikfehler, während Sie schreiben: im Browser und in jeder App unter macOS und Windows. Standardmäßig läuft es auf einem lokalen Modell. Kostenlos und Open Source.",
  },
  header: {
    github: "GitHub",
    language: "Sprache",
    theme: "Helles Design",
  },
  hero: {
    tagline: "Eine Rechtschreibprüfung, die auf Ihrem Rechner läuft.",
    repo: "Quellcode auf GitHub",
    download: {
      macos: "Download für macOS",
      windows: "Download für Windows",
      extension: "Erweiterung herunterladen",
    },
    other: "Weitere Downloads:",
    runs: "Läuft auf",
  },
  features: {
    title: "Was es tut",
    fix: {
      title: "Korrigiert ein Wort nach dem anderen",
      body: "Fehler werden direkt im Eingabefeld unterstrichen. Fahren Sie über einen, klicken Sie auf die Korrektur, und genau dieses Wort ändert sich. Sonst nichts, und Cmd+Z oder Strg+Z macht es rückgängig.",
    },
    rewrite: {
      title: "Formuliert um, wenn Sie es wollen",
      body: "Markieren Sie einen Satz, um drei Versionen davon zu erhalten. Eine Version, in der eine Zahl, ein Name oder ein Link fehlt, wird nie angezeigt.",
    },
    memory: {
      title: "Merkt sich, was Sie abgelehnt haben",
      body: "Wörter in Ihrem Wörterbuch werden nie geändert. Eine einmal ignorierte Korrektur wird nie wieder vorgeschlagen, auf keiner Website.",
    },
  },
  machine: {
    title: "Auf Ihrem Rechner",
    where: "Wo es läuft",
    models: "Welches Modell",
    unsupported: "Firefox und Safari: Nutzen Sie die Desktop-App.",
    body: "Standardmäßig laufen die Prüfungen auf einem lokalen Modell: Ollama oder Gemini Nano, das in Chrome eingebaut ist. In beiden Fällen bleibt Ihr Text auf Ihrem Computer.",
    byok: "Sie können auch Ihren eigenen API-Schlüssel für OpenAI, Anthropic, Mistral oder einen anderen Anbieter hinterlegen. Die Prüfungen gehen dann direkt von Ihrem Computer an diesen Anbieter.",
    privacy: "Datenschutzerklärung",
    extension: {
      title: "Browser-Erweiterung",
      body: "Für Chromium-Browser wie Chrome und Arc. Funktioniert in Textfeldern und Rich-Text-Editoren.",
    },
    desktop: {
      title: "Desktop-App",
      body: "Prüft, was Sie in einer beliebigen App unter macOS und Windows tippen.",
    },
  },
  benchmark: {
    title: "Gemessen",
    body: "Bewertet mit dem lokalen Standardmodell auf einem M2 Pro.",
    method: "So wird gemessen",
    basic: "kurze Sätze korrigiert",
    handwritten: "schnell getippte Nachrichten korrigiert",
    rewrites: "Umformulierungen behalten",
    latency: "Median pro Prüfung",
  },
  vignettes: {
    fix: { before: "Wir sehen uns am ", from: "freitag", to: "Freitag", after: "." },
    rewrite: {
      sentence: "Es scheint im Moment gut genug zu funktionieren.",
      variants: [
        "Bisher funktioniert es gut.",
        "Im Moment funktioniert es gut.",
        "Bis jetzt läuft es gut.",
      ],
    },
    memory: {
      dictionary: "Wörterbuch",
      ignored: "Auf allen Seiten ignoriert",
      from: "nö",
      to: "nein",
    },
  },
  close: "Schreiben Sie weiter. prosed liest mit.",
  footer: {
    license: "MIT-Lizenz",
    credit: "prosed begann als Fork von {upstream} von Igor Adrov.",
    readme: "README",
    changelog: "Änderungsprotokoll",
  },
  demo: {
    label:
      "Animiertes Beispiel: prosed unterstreicht zwei Fehler in einer Nachricht, korrigiert sie und formuliert dann einen langen Satz um.",
    text: "Ich glaube, das wir die Version am freitag veröffentlichen. Wir haben fast die ganze Woche mit dem Team in Lyon die neue Umformulierungsfunktion getestet, und bisher scheint sie ziemlich gut zu funktionieren.",
    fixes: [
      { from: "das", to: "dass" },
      { from: "freitag", to: "Freitag" },
    ],
    rewrite: {
      sentence:
        "Wir haben fast die ganze Woche mit dem Team in Lyon die neue Umformulierungsfunktion getestet, und bisher scheint sie ziemlich gut zu funktionieren.",
      variants: [
        "Wir haben die neue Umformulierungsfunktion fast die ganze Woche mit dem Team in Lyon getestet, und bisher funktioniert sie gut.",
        "Mit dem Team in Lyon haben wir fast die ganze Woche die neue Umformulierungsfunktion getestet. Bisher läuft sie gut.",
        "Fast die ganze Woche haben wir mit dem Team in Lyon die neue Umformulierungsfunktion geprüft, und sie funktioniert bisher gut.",
      ],
    },
    ui: {
      fixes: "Korrekturen",
      acceptAll: "Alle anwenden",
      rewrite: "Umformulieren",
      rewrites: "Umformulierungen",
    },
  },
};
