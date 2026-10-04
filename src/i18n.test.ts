import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogs,
  resolveLocale,
  setLocale,
  t,
  toneMessages,
  formalityMessages,
} from "./i18n/index.ts";
import { defaultSettings, loadSettings, saveSettings } from "./settings.ts";
import { grammarPrompt, rewritePrompt, tones } from "./prompts.ts";
import { check, rewrite, formality, tonesFor, type Generate } from "./check.ts";
import { findFalseFriends } from "./falseFriends.ts";
import { noteTranslation } from "./i18n/index.ts";

test("localizes Gemini download states and preserves its product name", () => {
  setLocale("fr");
  assert.equal(t("downloadGemini"), "Télécharger Gemini Nano");
  assert.equal(
    t("geminiDownloadProgress", { percent: 42 }),
    "Téléchargement de Gemini Nano… 42 %",
  );
  assert.equal(
    t("geminiDownloadRequiredOption"),
    "Gemini Nano · Chrome (téléchargement requis)",
  );
  setLocale("en");
});

test("localizes explanatory notes without changing the notes used in prompts", () => {
  const notes = findFalseFriends(
    "Actually, I assisted to the meeting. I have informations.",
  ).notes;
  setLocale("fr");
  for (const note of notes) {
    const translation = noteTranslation(note);
    assert.ok(translation, note);
    assert.notEqual(t(translation.key, translation.values), note);
  }
  assert.deepEqual(
    findFalseFriends(
      "Actually, I assisted to the meeting. I have informations.",
    ).notes,
    notes,
  );
  setLocale("en");
});

test("resolves system locales and safely falls back to English", () => {
  assert.equal(resolveLocale("system", ["fr-CA", "en-US"]), "fr");
  assert.equal(resolveLocale("system", ["pt-BR", "de-DE"]), "de");
  assert.equal(resolveLocale("system", ["es-ES"]), "es");
  assert.equal(resolveLocale("system", ["it-IT"]), "it");
  assert.equal(resolveLocale("system", ["ja-JP"]), "en");
  assert.equal(resolveLocale("it", ["fr-FR"]), "it");
  assert.equal(resolveLocale("corrupted", ["fr-FR"]), "fr");
});

test("translates interface labels and interpolates user values literally", () => {
  setLocale("fr");
  assert.equal(t("settings"), "Réglages");
  assert.equal(t("suggestions", { count: 1 }), "1 suggestion");
  assert.equal(t("suggestions", { count: 3 }), "3 suggestions");
  assert.equal(
    t("addWord", { word: "$& <Sencrop> {count}" }),
    "Ajouter $& <Sencrop> {count} au dictionnaire",
  );
  setLocale("en");
});

test("every locale covers tone labels, formality and interpolation tokens", () => {
  const keys = Object.keys(catalogs.en).sort();
  for (const [locale, messages] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(messages).sort(), keys, locale);
    for (const key of keys) {
      const source = catalogs.en[key as keyof typeof catalogs.en];
      const translated = messages[key as keyof typeof messages];
      assert.ok(translated.trim(), `${locale}.${key}`);
      assert.deepEqual(
        translated.match(/\{\w+\}/g)?.sort(),
        source.match(/\{\w+\}/g)?.sort(),
        `${locale}.${key}`,
      );
    }
    setLocale(locale);
    for (const tone of Object.keys(tones)) {
      assert.ok(t(toneMessages[tone as keyof typeof tones]));
    }
    assert.equal(formalityMessages.length, 5);
    if (locale !== "en") {
      assert.notEqual(t("settings"), catalogs.en.settings);
      assert.notEqual(t("toneFormal"), catalogs.en.toneFormal);
    }
  }
  setLocale("en");
});

test("existing settings acquire a UI locale and locale changes preserve writing preferences", async () => {
  let stored: Record<string, unknown> = {
    dictionary: ["Sencrop"],
    style: { english: "uk" },
  };
  const previous = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      sync: {
        get: async () => stored,
        set: async (changes: object) => {
          stored = { ...stored, ...changes };
        },
      },
    },
  } as unknown as typeof chrome;
  try {
    const original = await loadSettings();
    assert.equal(original.uiLocale, "system");
    await saveSettings({ uiLocale: "de" });
    const changed = await loadSettings();
    assert.equal(changed.uiLocale, "de");
    assert.deepEqual(changed.dictionary, original.dictionary);
    assert.deepEqual(changed.style, original.style);
    stored.uiLocale = "invalid";
    assert.equal((await loadSettings()).uiLocale, "system");
  } finally {
    globalThis.chrome = previous;
  }
});

test("UI language never changes model requests or the language of input and output", async () => {
  const text = "Please send the Sencrop report before the 15th.";
  const baselineGrammar = grammarPrompt(text, defaultSettings);
  const baselineRewrite = rewritePrompt({
    text,
    settings: defaultSettings,
    tone: "formal",
  });
  let baseline: unknown;
  for (const uiLocale of ["en", "fr", "de", "es", "it"] as const) {
    setLocale(uiLocale);
    const settings = { ...defaultSettings, uiLocale };
    assert.equal(grammarPrompt(text, settings), baselineGrammar);
    assert.equal(
      rewritePrompt({ text, settings, tone: "formal" }),
      baselineRewrite,
    );
    assert.ok(tonesFor(text).includes("natural"));
    const requests: unknown[] = [];
    const generate: Generate = async (request) => {
      requests.push(request);
      return request.channel === "meter"
        ? { formality: 3 }
        : request.channel === "rewrite"
          ? { variants: ["Kindly send the Sencrop report before the 15th."] }
          : { correctedText: text };
    };
    assert.equal(await check({ text, settings, generate }), text);
    assert.deepEqual(
      (await rewrite({ text, settings, tone: "formal", generate })).variants,
      ["Kindly send the Sencrop report before the 15th."],
    );
    assert.equal(await formality({ text, settings, generate }), 3);
    if (baseline) assert.deepEqual(requests, baseline);
    else baseline = requests;
  }
  setLocale("en");
});
