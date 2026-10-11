import type { Content } from "./en";

export const fr: Content = {
  meta: {
    title: "prosed · un correcteur qui tourne sur votre machine",
    description:
      "prosed souligne les fautes d’orthographe et de grammaire pendant que vous écrivez, dans le navigateur et dans toutes les apps sur macOS et Windows. Il tourne par défaut sur un modèle local. Gratuit et open source.",
  },
  header: {
    github: "GitHub",
    language: "Langue",
    theme: "Thème clair",
  },
  hero: {
    tagline: "Un correcteur qui tourne sur votre machine.",
    repo: "Le code sur GitHub",
    download: {
      macos: "Télécharger pour macOS",
      windows: "Télécharger pour Windows",
      extension: "Télécharger l’extension",
    },
    other: "Autres téléchargements :",
    runs: "Tourne sur",
  },
  features: {
    title: "Ce qu’il fait",
    fix: {
      title: "Corrige un mot à la fois",
      body: "Les fautes sont soulignées dans le champ où vous écrivez. Survolez-en une, cliquez sur la correction, et ce mot change. Rien d’autre ne bouge, et Cmd+Z ou Ctrl+Z annule.",
    },
    rewrite: {
      title: "Reformule quand vous le demandez",
      body: "Sélectionnez une phrase pour en obtenir trois versions. Une version qui perd un nombre, un nom ou un lien n’est jamais proposée.",
    },
    memory: {
      title: "Se souvient de vos refus",
      body: "Les mots de votre dictionnaire ne sont jamais modifiés. Une correction ignorée une fois n’est plus jamais proposée, sur aucun site.",
    },
  },
  machine: {
    title: "Sur votre machine",
    where: "Où il tourne",
    models: "Quel modèle",
    unsupported: "Firefox et Safari : utilisez l’app de bureau.",
    body: "Par défaut, les vérifications tournent sur un modèle local : Ollama, ou Gemini Nano intégré à Chrome. Dans les deux cas, votre texte reste sur votre ordinateur.",
    byok: "Vous pouvez aussi ajouter votre propre clé API OpenAI, Anthropic, Mistral ou d’un autre fournisseur. Les vérifications partent alors directement de votre ordinateur vers ce fournisseur.",
    privacy: "Politique de confidentialité",
    extension: {
      title: "Extension de navigateur",
      body: "Pour les navigateurs Chromium comme Chrome et Arc. Fonctionne dans les zones de texte et les éditeurs riches.",
    },
    desktop: {
      title: "App de bureau",
      body: "Vérifie ce que vous tapez dans n’importe quelle app sur macOS et Windows.",
    },
  },
  benchmark: {
    title: "Mesuré",
    body: "Noté avec le modèle local par défaut, sur un M2 Pro.",
    method: "Comment c’est mesuré",
    basic: "phrases courtes corrigées",
    handwritten: "messages tapés vite corrigés",
    rewrites: "variantes de reformulation gardées",
    latency: "temps médian par vérification",
  },
  vignettes: {
    fix: { before: "Je crois que ", from: "sa", to: "ça", after: " va marcher." },
    rewrite: {
      sentence: "Ça a l’air de marcher assez bien pour l’instant.",
      variants: [
        "Ça marche bien pour l’instant.",
        "Pour l’instant, ça marche bien.",
        "Jusqu’ici, ça marche bien.",
      ],
    },
    memory: {
      dictionary: "Dictionnaire",
      ignored: "Ignoré sur tous les sites",
      from: "ouais",
      to: "oui",
    },
  },
  close: "Continuez d’écrire. prosed relit avec vous.",
  footer: {
    license: "Licence MIT",
    credit: "prosed est né d’un fork de {upstream} par Igor Adrov.",
    readme: "README",
    changelog: "Journal des versions",
  },
  demo: {
    label:
      "Exemple animé : prosed souligne deux fautes dans un message, les corrige, puis reformule une longue phrase.",
    text: "Je pense que sa va marcher, on a tester hier soir. On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et pour l'instant elle a l'air de plutôt bien marcher.",
    fixes: [
      { from: "sa", to: "ça" },
      { from: "tester", to: "testé" },
    ],
    rewrite: {
      sentence:
        "On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et pour l'instant elle a l'air de plutôt bien marcher.",
      variants: [
        "On a passé presque toute la semaine sur la nouvelle fonction de reformulation avec l'équipe de Lyon, et elle marche plutôt bien pour l'instant.",
        "Avec l'équipe de Lyon, on a consacré presque toute la semaine à la nouvelle fonction de reformulation, qui marche bien pour l'instant.",
        "La nouvelle fonction de reformulation nous a occupés presque toute la semaine avec l'équipe de Lyon. Pour l'instant, elle marche bien.",
      ],
    },
    ui: {
      fixes: "Corrections",
      acceptAll: "Tout appliquer",
      rewrite: "Reformuler",
      rewrites: "Reformulations",
    },
  },
};
