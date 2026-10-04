// The grammar check, rewrites and formality meter, without the DOM or a model client. Each host
// passes its own `generate`: the extension's service worker, the desktop app's Rust side, the
// benchmarks' fetch, a fake in tests.
import { z } from "zod";
import {
  formalityPrompt,
  formalitySchema,
  grammarPrompt,
  rewritePrompt,
  rewriteSchema,
  tones,
  type Tone,
} from "./prompts.ts";
import type { Settings } from "./settings.ts";
import { keepUserText, languageOf, prepareRewrite, splitCheckable } from "./contentScript/text.ts";

// A new request on a channel cancels the previous one on that channel, in the same tab or window.
export type Channel = "check" | "fix" | "rewrite" | "meter";

// The model's parsed JSON answer to `prompt`, shaped by `schema`. Gemini has one model and ignores `model`.
export type Generate = (request: {
  channel: Channel;
  model: string;
  prompt: string;
  schema: Record<string, unknown>;
}) => Promise<unknown>;

const corrected = z.object({ correctedText: z.string() });
const correctedSchema = z.toJSONSchema(corrected, { target: "draft-7" });
const rewriteOutput = z.object({ variants: z.array(z.string()) });
const formalityOutput = z.object({ formality: z.number().int().min(1).max(5) });

// rarely works with single words
const enough = (core: string) => core.split(/\s+/).length >= 2;

// Whether `check` would ask the model, so a host can skip its loading state.
export const worthChecking = (text: string) => enough(splitCheckable(text).core);

// The corrected text, or null when there's too little to check.
export const check = async ({
  text,
  settings,
  generate,
  channel = "check",
}: {
  text: string;
  settings: Settings;
  generate: Generate;
  channel?: Channel;
}) => {
  const { before, core, after } = splitCheckable(text);
  if (!enough(core)) {
    return null;
  }
  const json = await generate({ channel, model: settings.model, prompt: grammarPrompt(core, settings), schema: correctedSchema });
  const fixed = corrected.parse(json).correctedText.trim();
  return before + keepUserText(core, fixed, settings.dictionary, settings.ignored) + after;
};

// "More natural" is for English written as a second language.
export const tonesFor = (text: string) =>
  (Object.keys(tones) as Tone[]).filter((t) => t !== "natural" || languageOf(text) === "English");

// The text a selection was taken from, and where it starts there.
type Field = { text: string; start: number };

const prepare = ({ text, tone, field }: { text: string; tone: Tone; field?: Field | null }) =>
  prepareRewrite({ all: field?.text ?? text, start: field?.start ?? 0, text, tone });

// Makes a fixed or rewritten selection fit back in its sentence, without its spaces around.
export const fitSelection = ({ text, field }: { text: string; field?: Field | null }) =>
  prepare({ text, tone: "clearer", field }).fit;

// Variants that passed the checks, and notes to show under them.
export type Rewrite = { variants: string[]; notes: string[] };

export const rewrite = async ({
  text,
  tone,
  settings,
  field,
  generate,
}: {
  text: string;
  tone: Tone;
  settings: Settings;
  field?: Field | null;
  generate: Generate;
}): Promise<Rewrite> => {
  const { request, falseFriends, keep } = prepare({ text, tone, field });
  const json = await generate({
    channel: "rewrite",
    model: settings.model,
    prompt: rewritePrompt({ ...request, settings }),
    schema: rewriteSchema,
  });
  let variants = rewriteOutput.parse(json).variants;
  // Some models put the numbered alternatives inside a single array item.
  if (variants.length === 1 && !/\bVersion\s+[123]\s*:/i.test(text)) {
    const bundled = variants[0].trim().match(/^Version\s+1\s*:\s*([\s\S]+?)\s+Version\s+2\s*:\s*([\s\S]+?)\s+Version\s+3\s*:\s*([\s\S]+)$/i);
    if (bundled) variants = bundled.slice(1);
  }
  return { variants: keep(variants, settings.dictionary), notes: falseFriends };
};

// How formal the text sounds, 1 to 5, on its own channel so it doesn't cancel the rewrite.
export const formality = async ({ text, settings, generate }: { text: string; settings: Settings; generate: Generate }) => {
  const json = await generate({ channel: "meter", model: settings.model, prompt: formalityPrompt(text.trim()), schema: formalitySchema });
  return formalityOutput.parse(json).formality;
};
