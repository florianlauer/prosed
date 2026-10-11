import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { LOCALES } from "../i18n/locales";
import { PICKED_VARIANT, buildFrames, findWord, segments, stillFrameIndex } from "./frames";

describe("findWord", () => {
  it("matches whole words only, accents included", () => {
    expect(findWord("esta está", "esta")).toEqual([{ start: 0, end: 4 }]);
    expect(findWord("passé sa", "sa")).toEqual([{ start: 6, end: 8 }]);
  });
});

describe.each(LOCALES)("demo data %s", (locale) => {
  const demo = contentFor(locale).demo;

  it("has every fix exactly once as a whole word", () => {
    for (const fix of demo.fixes) expect(findWord(demo.text, fix.from)).toHaveLength(1);
  });

  it("has at least two fixes, one for the card and one for the panel", () => {
    expect(demo.fixes.length).toBeGreaterThanOrEqual(2);
  });

  it("finds the sentence to rewrite once the fixes are applied", () => {
    let text = demo.text;
    for (const fix of demo.fixes) {
      const [range] = findWord(text, fix.from);
      if (range) text = text.slice(0, range.start) + fix.to + text.slice(range.end);
    }
    expect(text).toContain(demo.rewrite.sentence);
  });

  it("offers three variants that differ from the sentence", () => {
    expect(demo.rewrite.variants).toHaveLength(3);
    for (const variant of demo.rewrite.variants) expect(variant).not.toBe(demo.rewrite.sentence);
  });
});

describe("buildFrames", () => {
  const demo = contentFor("en").demo;
  const frames = buildFrames(demo);

  it("starts by typing the first character", () => {
    expect(frames[0]?.text).toBe(demo.text.charAt(0));
  });

  it("ends on the fixed text with the picked variant in place", () => {
    const expected =
      "I think they're going to ship the release on Friday. " +
      demo.rewrite.variants[PICKED_VARIANT];
    expect(frames.at(-1)?.text).toBe(expected);
  });

  it("keeps every range inside its frame's text", () => {
    for (const frame of frames) {
      for (const range of [...frame.mistakes, ...(frame.selection ? [frame.selection] : [])]) {
        expect(range.end).toBeLessThanOrEqual(frame.text.length);
      }
    }
  });

  it("holds every frame for a positive time", () => {
    expect(frames.every((frame) => frame.hold > 0)).toBe(true);
  });

  it("has a still frame with both mistakes underlined and the fix card open", () => {
    const still = frames[stillFrameIndex(frames)];
    expect(still?.popup?.kind).toBe("fix");
    expect(still?.mistakes).toHaveLength(2);
    expect(still?.press).toBe(false);
  });
});

describe("segments", () => {
  it("covers the whole text and marks the ranges", () => {
    const text = "a their b friday c";
    const parts = segments({
      text,
      mistakes: findWord(text, "their").concat(findWord(text, "friday")),
      selection: null,
    });
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.mark === "mistake").map((part) => part.text)).toEqual([
      "their",
      "friday",
    ]);
  });

  it("marks a selection", () => {
    const parts = segments({ text: "one two", mistakes: [], selection: { start: 4, end: 7 } });
    expect(parts).toEqual([
      { text: "one ", start: 0, mark: null },
      { text: "two", start: 4, mark: "selection" },
    ]);
  });
});
