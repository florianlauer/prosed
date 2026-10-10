// The reference text. Every other language is typed against it.
export const en = {
  meta: {
    title: "prosed · a grammar checker that runs on your machine",
    description:
      "prosed underlines spelling and grammar mistakes as you type, in your browser and in every app on macOS and Windows. It runs on a local model by default. Free and open source.",
  },
  header: {
    github: "GitHub",
    language: "Language",
    theme: "Light theme",
  },
  hero: {
    tagline: "A grammar checker that runs on your machine.",
    repo: "Source on GitHub",
    download: {
      macos: "Download for macOS",
      windows: "Download for Windows",
      extension: "Download the extension",
    },
    other: "Other downloads:",
    runs: "Runs on",
  },
  features: {
    title: "What it does",
    fix: {
      title: "Fixes one word at a time",
      body: "Mistakes are underlined inside the field you type in. Hover one, click the fix, and that word changes. Nothing else does, and Cmd+Z or Ctrl+Z undoes it.",
    },
    rewrite: {
      title: "Rewrites when you ask",
      body: "Select a sentence to get three versions of it. A version that drops a number, a name or a link is never shown.",
    },
    memory: {
      title: "Remembers what you refused",
      body: "Words in your dictionary are never changed. A fix you ignore once is never proposed again, on any site.",
    },
  },
  machine: {
    title: "On your machine",
    where: "Where it runs",
    models: "Which model",
    unsupported: "Firefox and Safari: use the desktop app.",
    body: "Checks run on a local model by default: Ollama, or Gemini Nano built into Chrome. With either one, your text stays on your computer.",
    byok: "You can also add your own API key for OpenAI, Anthropic, Mistral or another provider. Checks then go straight from your computer to that provider.",
    privacy: "Privacy policy",
    extension: {
      title: "Browser extension",
      body: "For Chromium browsers such as Chrome and Arc. Works in text areas and rich editors.",
    },
    desktop: {
      title: "Desktop app",
      body: "Checks the text you type in any app on macOS and Windows.",
    },
  },
  benchmark: {
    title: "Measured",
    body: "Graded on the default local model, on an M2 Pro.",
    method: "How it’s measured",
    basic: "short sentences fixed",
    handwritten: "fast-typed messages fixed",
    rewrites: "rewrite variants kept",
    latency: "median time per check",
  },
  vignettes: {
    fix: { before: "See you on ", from: "friday", to: "Friday", after: "." },
    rewrite: {
      sentence: "It seems to work well enough for now.",
      variants: ["It works well so far.", "So far, it works well.", "For now, it works well."],
    },
    memory: {
      dictionary: "Dictionary",
      ignored: "Ignored on every site",
      from: "gonna",
      to: "going to",
    },
  },
  close: "Keep typing. prosed reads along.",
  footer: {
    license: "MIT license",
    // "{upstream}" is replaced by a link to the original project.
    credit: "prosed started as a fork of {upstream} by Igor Adrov.",
    readme: "README",
    changelog: "Changelog",
  },
  demo: {
    label:
      "Animated example: prosed underlines two mistakes in a message, fixes them, then rewrites a long sentence.",
    text: "I think their going to ship the release on friday. We spent most of the week testing the new rewrite feature with the team in Lyon, and it seems to work well enough for now.",
    fixes: [
      { from: "their", to: "they're" },
      { from: "friday", to: "Friday" },
    ],
    rewrite: {
      sentence:
        "We spent most of the week testing the new rewrite feature with the team in Lyon, and it seems to work well enough for now.",
      variants: [
        "We spent most of the week testing the new rewrite feature with the team in Lyon, and it works well so far.",
        "The team in Lyon and I tested the new rewrite feature for most of the week, and it works well for now.",
        "Most of our week went into testing the new rewrite feature with the team in Lyon. So far it works well.",
      ],
    },
    ui: { fixes: "Fixes", acceptAll: "Accept all", rewrite: "Rewrite", rewrites: "Rewrites" },
  },
};

export type Content = typeof en;
