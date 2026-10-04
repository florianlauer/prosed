// Prompts, kept free of DOM and extension APIs so the benchmark sends exactly these.
import { languageOf } from "./contentScript/text.ts";
import type { Settings, Style } from "./settings.ts";

// Only non-default choices add a line, so the default prompt stays the one the benchmark measured.
const styleRules = ({ address, english, informal }: Style) =>
  [
    address !== "any" &&
      `In French, address the reader as "${address}" and adjust the verbs and pronouns to match.`,
    english === "us" && "In English, use American spelling (color, organize).",
    english === "uk" && "In English, use British spelling (colour, organise).",
    // a softer "replace informal words" was ignored by gemma4; the examples make it stick
    informal === "fix" &&
      `Informal and spoken words are mistakes here: replace them with their standard written form, for example "du coup" → "donc", "gonna" → "going to", "ouais" → "oui".`,
  ].filter(Boolean);

// Extra instructions from the settings, as a paragraph, or nothing.
const settingsRules = ({ dictionary, style }: Settings) => {
  const rules = [
    ...styleRules(style),
    dictionary.length && `Leave these words exactly as written: ${dictionary.join(", ")}.`,
  ].filter(Boolean);
  return rules.length ? `\n\n${rules.join("\n")}` : "";
};

export const grammarPrompt = (text: string, settings: Settings) =>
  `Fix the spelling, grammar and punctuation of the text below. Typos may be missing letters, apostrophes or accents: use the surrounding context to recover the intended word. Keep the original language, meaning, tone and technical terms; change as little as possible. If the text is already correct, return it unchanged.${settingsRules(settings)}\n\nText:\n${text}`;

export const rewriteSchema = {
  type: "object",
  properties: { variants: { type: "array", items: { type: "string" } } },
  required: ["variants"],
};

// The words around a part of a sentence, when only part of it is rewritten.
export type RewriteContext = { before: string; after: string };

// The presets on the rewrite card. "clearer" is the plain rewrite.
export const tones = {
  clearer: { label: "Clearer", instruction: "so it reads more clearly" },
  formal: { label: "More formal", instruction: "so it sounds more formal and professional" },
  friendly: {
    label: "Friendlier",
    instruction: "so it sounds friendlier and warmer, without becoming casual",
  },
  confident: {
    label: "More confident",
    instruction: `so it sounds more confident: drop hedges like "I think", "maybe" or "just", and state things directly`,
  },
  shorter: {
    label: "Shorter",
    instruction: "so it is shorter: cut filler words and repetition, and keep every piece of information",
  },
  // English only; rewritePrompt adds who the writer is
  natural: {
    label: "More natural",
    instruction: "so it sounds natural to a native English speaker, and keep the writer's meaning",
  },
} as const;

// Who wrote an English text, for "More natural": the language its false friends point to, and
// notes on the ones in the part to rewrite (src/falseFriends.ts).
export type Writer = { language: string | null; falseFriends: string[] };

export type Tone = keyof typeof tones;

// Naming the language matters: with "keep the original language" gemma4 translated a French
// sentence to English, and with "a French text gets French versions" it turned English into French.
export const rewritePrompt = ({
  text,
  settings,
  context = null,
  tone = "clearer",
  writer = null,
}: {
  text: string;
  settings: Settings;
  context?: RewriteContext | null;
  tone?: Tone;
  writer?: Writer | null;
}) => {
  const language = languageOf((context?.before ?? "") + text + (context?.after ?? ""));
  const what = context ? "the part of a sentence below" : "the text below";
  const natural = tone === "natural";
  // "may", since some of these words are right in English too ("Actually, I disagree")
  const hints = natural && writer?.language && writer.falseFriends.length
    ? `\n\nThe writer may have used some of these words in their ${writer.language} sense. Change one only if the text shows that sense:\n${writer.falseFriends.map((n) => `- ${n}`).join("\n")}`
    : "";
  // "seems": the language comes from the false friends, and a native speaker writes "Actually" too
  const who = natural && writer?.language
    ? `The text below seems to be written in English by a native ${writer.language} speaker. `
    : "";
  return `${who}Rewrite ${what} ${tones[tone].instruction}. Give 3 different versions.${
    language
      ? ` The text is in ${language}: write every version in ${language}.`
      : " Write every version in the language of the text."
  }${
    context
      ? " Each version replaces only this part, so it must fit between the words before and after it: don't repeat them, and don't start a new sentence."
      : ""
  } Keep the meaning, and every name, acronym, number and link as written. Don't add placeholders, brackets or notes. Fix any mistakes along the way.${hints}${settingsRules(settings)}\n\n${
    context ? `Before: ${context.before}\nAfter: ${context.after}\n\nPart to rewrite:` : "Text:"
  }\n${text}`;
};

export const formalityLevels = ["Very casual", "Casual", "Neutral", "Formal", "Very formal"] as const;

export const formalitySchema = {
  type: "object",
  properties: { formality: { type: "integer", minimum: 1, maximum: 5 } },
  required: ["formality"],
};

// One scale instead of a list of tones: asking gemma4 to name the tone gave "friendly, curt,
// curt" for a neutral message, while this scale matched 10 of 12 labelled texts, 12 within one step.
export const formalityPrompt = (text: string) =>
  `Rate how formal the text below sounds, on a scale from 1 to 5: 1 is very casual (slang, texting), 2 is casual (a message to a colleague you know well), 3 is neutral, 4 is formal (a polite business email), 5 is very formal (official or legal letters). Judge the tone only, not the grammar.\n\nText:\n${text}`;
