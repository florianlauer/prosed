import { catalogs, type MessageKey } from "./catalogs.ts";
import type { Tone } from "../prompts.ts";

export { catalogs, type MessageKey };
export type Locale = keyof typeof catalogs;
export type UiLocale = Locale | "system";
export type Values = Record<string, string | number>;

export const isUiLocale = (value: unknown): value is UiLocale =>
  value === "system" ||
  (typeof value === "string" && Object.hasOwn(catalogs, value));

export const resolveLocale = (
  value: unknown,
  preferred: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages,
): Locale => {
  if (isUiLocale(value) && value !== "system") return value;
  for (const language of preferred) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (Object.hasOwn(catalogs, base)) return base as Locale;
  }
  return "en";
};

let locale = resolveLocale("system");
export const getLocale = () => locale;
export const setLocale = (value: unknown) => {
  locale = resolveLocale(value);
};

export const t = (key: MessageKey, values: Values = {}): string => {
  if (key === "suggestions" && values.count === 1) key = "suggestionOne";
  if (key === "acceptAllHint" && values.count === 1) key = "acceptOneHint";
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
};

export const toneMessages = {
  clearer: "toneClearer",
  formal: "toneFormal",
  friendly: "toneFriendly",
  confident: "toneConfident",
  shorter: "toneShorter",
  natural: "toneNatural",
} as const satisfies Record<Tone, MessageKey>;

export const formalityMessages = [
  "formalityVeryCasual",
  "formalityCasual",
  "formalityNeutral",
  "formalityFormal",
  "formalityVeryFormal",
] as const;

// The checker also uses these English notes in prompts; translate only their display.
export const noteTranslation = (
  note: string,
): { key: MessageKey; values: Values } | null => {
  const plural = note.match(
    /^"([^"]+)" has no plural in English: write "([^"]+)"\.$/,
  );
  if (plural)
    return {
      key: "notePlural",
      values: { word: plural[1], singular: plural[2] },
    };
  const key = (Object.keys(catalogs.en) as MessageKey[]).find(
    (key) => key.startsWith("note") && catalogs.en[key] === note,
  );
  return key ? { key, values: {} } : null;
};
