export type Fix = { from: string; to: string };
export type Demo = {
  text: string;
  fixes: Fix[];
  rewrite: { sentence: string; variants: string[] };
};
export type Range = { start: number; end: number };
export type Popup =
  | { kind: "fix"; on: Range; to: string }
  | { kind: "panel"; items: Fix[] }
  | { kind: "rewrite-button"; on: Range }
  | { kind: "rewrite"; on: Range; variants: string[]; picked: number | null };
export type Frame = {
  text: string;
  mistakes: Range[];
  selection: Range | null;
  badge: number;
  popup: Popup | null;
  press: boolean;
  // How long the frame stays on screen, in ms.
  hold: number;
};
export type Segment = { text: string; start: number; mark: "mistake" | "selection" | null };

export const PICKED_VARIANT = 0;

const LETTER = "[\\p{L}\\p{N}]";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findWord(text: string, word: string): Range[] {
  const pattern = new RegExp(`(?<!${LETTER})${escape(word)}(?!${LETTER})`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + word.length,
  }));
}

function rangeOf(text: string, word: string): Range {
  const [range] = findWord(text, word);
  if (!range) throw new Error(`"${word}" is not in the demo text`);
  return range;
}

const replaceAt = (text: string, { start, end }: Range, by: string) =>
  text.slice(0, start) + by + text.slice(end);

export function buildFrames({ text, fixes, rewrite }: Demo): Frame[] {
  const frames: Frame[] = [];
  const push = (frame: Partial<Frame> & Pick<Frame, "text" | "hold">) =>
    frames.push({ mistakes: [], selection: null, badge: 0, popup: null, press: false, ...frame });
  const marks = (current: string, list: Fix[]) => list.map((fix) => rangeOf(current, fix.from));

  for (let i = 1; i <= text.length; i++) {
    // Pause a little after punctuation, like a person typing.
    push({ text: text.slice(0, i), hold: /[.,!?]/.test(text.charAt(i - 1)) ? 220 : 38 });
  }
  // The product checks after 500 ms without typing.
  push({ text, hold: 500 });

  const [first, ...rest] = fixes;
  const picked = rewrite.variants[PICKED_VARIANT];
  if (!first || rest.length === 0 || picked === undefined) {
    throw new Error("The demo needs two fixes and a variant to pick");
  }
  const firstRange = rangeOf(text, first.from);
  const withCard = { text, mistakes: marks(text, fixes), badge: fixes.length };
  push({ ...withCard, hold: 900 });
  push({ ...withCard, popup: { kind: "fix", on: firstRange, to: first.to }, hold: 1400 });
  push({
    ...withCard,
    popup: { kind: "fix", on: firstRange, to: first.to },
    press: true,
    hold: 250,
  });

  let current = replaceAt(text, firstRange, first.to);
  const withPanel = { text: current, mistakes: marks(current, rest), badge: rest.length };
  push({ ...withPanel, hold: 700 });
  push({ ...withPanel, popup: { kind: "panel", items: rest }, hold: 1600 });
  push({ ...withPanel, popup: { kind: "panel", items: rest }, press: true, hold: 250 });

  for (const fix of rest) current = replaceAt(current, rangeOf(current, fix.from), fix.to);
  push({ text: current, hold: 800 });

  const start = current.indexOf(rewrite.sentence);
  if (start < 0) throw new Error("The sentence to rewrite is not in the fixed text");
  const on = { start, end: start + rewrite.sentence.length };
  const card = (choice: number | null): Popup => ({
    kind: "rewrite",
    on,
    variants: rewrite.variants,
    picked: choice,
  });
  push({ text: current, selection: on, hold: 500 });
  push({ text: current, selection: on, popup: { kind: "rewrite-button", on }, hold: 900 });
  push({
    text: current,
    selection: on,
    popup: { kind: "rewrite-button", on },
    press: true,
    hold: 250,
  });
  push({ text: current, selection: on, popup: card(null), hold: 1800 });
  push({ text: current, selection: on, popup: card(PICKED_VARIANT), press: true, hold: 400 });
  push({ text: replaceAt(current, on, picked), hold: 2600 });

  return frames;
}

// Shown before hydration, without JavaScript and with reduced motion.
export const stillFrameIndex = (frames: Frame[]) =>
  frames.findIndex((frame) => frame.popup?.kind === "fix" && !frame.press);

export function segments({
  text,
  mistakes,
  selection,
}: Pick<Frame, "text" | "mistakes" | "selection">): Segment[] {
  const ranges = [
    ...mistakes.map((range) => ({ ...range, mark: "mistake" as const })),
    ...(selection ? [{ ...selection, mark: "selection" as const }] : []),
  ].sort((a, b) => a.start - b.start);
  const parts: Segment[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start > at) parts.push({ text: text.slice(at, range.start), start: at, mark: null });
    parts.push({ text: text.slice(range.start, range.end), start: range.start, mark: range.mark });
    at = range.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), start: at, mark: null });
  return parts;
}
