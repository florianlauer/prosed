// Level 2: checks the focused field of any app as the user types, and draws the extension's
// marks and badge over it. The card window shows what the pointer rests on.
import "./chrome.ts";
import "../../src/contentScript/overlay.css";
import "./overlay.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { checkIcon, powerIcon, spinnerIcon } from "../../src/contentScript/render.ts";
import { changeOf, markedSpan, splitCheckable, type Hunk } from "../../src/contentScript/text.ts";
import { addToDictionary, ignoreChange, loadSettings, onSettingsChange } from "../../src/settings.ts";
import { CheckSession } from "../../src/session.ts";
import { followTheme, generate, type App, type Rect } from "./api.ts";

type Tick = {
  app: App | null;
  // the field `text` is from: a new one gets its own check even with the same text
  id: number;
  text: string | null;
  field: Rect;
  // the rects of each range, one per line: the fixes, then the long sentences
  marks: Rect[][];
  cursor: [number, number];
  overCard: boolean;
};
const layers = { fix: document.getElementById("fixes")!, rewrite: document.getElementById("long")! };
const badge = document.getElementById("badge") as HTMLButtonElement;
followTheme();

let settings = await loadSettings();

// the focused field's text, null when there's none
let text: string | null = null;
// the text an applied fix leads to, so it doesn't start a new check
let expected: string | null = null;
let app: App | null = null;
let fieldId = -1;
let field: Rect = { x: 0, y: 0, width: 0, height: 0 };
let marks: Rect[][] = [];
// what the pointer rests on and what the card shows: a range's index, PANEL for the badge, or NONE
const NONE = -1;
const PANEL = -2;
let hovered = NONE;
let shown = NONE;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let clickable = false;
let glyph = "";

const inside = (r: Rect, x: number, y: number, below = 0) =>
  x >= r.x - 1 && x <= r.x + r.width + 1 && y >= r.y && y <= r.y + r.height + below;

const union = (rects: Rect[]): Rect => {
  if (!rects.length) {
    return field;
  }
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
};

const setBadge = (state: "hidden" | "loading" | "wrong" | "correct" | "error", html = "") => {
  badge.hidden = state === "hidden";
  badge.dataset.state = state;
  // skipped when unchanged, so the glyph's entrance doesn't replay on every keystroke
  if (html !== glyph) {
    glyph = html;
    badge.innerHTML = `<span class="aig-glyph">${html}</span>`;
  }
};

// The bottom right corner of the field, where the extension puts its trigger.
const placeBadge = ({ x, y, width, height }: Rect) => {
  const padding = height < 24 + 16 ? Math.max(0, height - 24) / 2 : 8;
  badge.style.left = `${x + width - 8 - 24}px`;
  badge.style.top = `${y + height - padding - 24}px`;
};

// Only the badge takes clicks, and only while the pointer is on it.
const setClickable = (on: boolean) => {
  if (on !== clickable) {
    clickable = on;
    invoke("set_overlay_clickable", { clickable: on });
  }
};

const sendMarks = () => {
  if (text !== null) {
    const ranges = [...session.hunks.map((hunk) => markedSpan(text!, hunk)), ...session.long.map(({ start, end }) => [start, end])];
    invoke("set_marks", { text, ranges });
  }
};

// The rects belong to the ranges sent to Rust; when the ranges change, they're stale until the
// next tick, and hovering them would open the wrong range.
const forgetMarks = () => {
  marks = [];
  hovered = NONE;
  clearTimeout(hoverTimer);
};

// The fixes and long sentences changed: the marks Rust measures and the badge follow.
const render = () => {
  if (text === null) {
    return;
  }
  forgetMarks();
  sendMarks();
  const state = session.state;
  if (state.type === "empty") {
    setBadge("hidden");
  } else if (state.type === "loading") {
    setBadge("loading", spinnerIcon);
  } else if (state.type === "error") {
    console.warn(state.error);
    setBadge("error", powerIcon);
  } else {
    const count = state.hunks.length;
    setBadge(count ? "wrong" : "correct", count ? `<span class="aig-count">${count}</span>` : checkIcon);
  }
};

const session = new CheckSession({ generate, settings: () => settings, pause: 800, onChange: render });

// Numbers the overlay's show_card and hide_card, so Rust drops one that arrives after a newer one,
// or after the card's own buttons or the shortcut took the card over (a new epoch).
// from the clock, so the numbers keep growing when the page reloads
let cardSeq = Date.now();
let cardEpoch = 0;
const showCard = (anchor: Rect, end: boolean, payload: object) =>
  invoke("show_card", { anchor, end, payload, seq: ++cardSeq, epoch: cardEpoch });

const hideCard = () => {
  if (shown !== NONE) {
    shown = NONE;
    invoke("hide_card", { seq: ++cardSeq, epoch: cardEpoch });
  }
};

// The panel, as in the extension: the fixes in the text, the long sentences, and the tones
// for the whole text. The card window builds it.
const openPanel = (current: string) => {
  const { before, core } = splitCheckable(current);
  showCard(badge.getBoundingClientRect(), true, {
    kind: "panel",
    field: fieldId,
    state: badge.dataset.state,
    error: session.state.type === "error" ? String(session.state.error) : "",
    text: current,
    result: session.result,
    long: session.long.map(({ start, end }, i) => ({
      start,
      end,
      text: current.slice(start, end),
      anchor: union(marks[session.hunks.length + i] ?? []),
    })),
    whole: core.trim() ? { text: core, start: before.length, end: before.length + core.length, anchor: field } : null,
    app,
  });
};

const open = (index: number, rect: Rect) => {
  if (text === null || index === shown) {
    return;
  }
  // a hover timer from before the ranges changed can point past them
  if (index !== PANEL && index >= session.hunks.length + session.long.length) {
    return;
  }
  shown = index;
  if (index === PANEL) {
    openPanel(text);
  } else if (index < session.hunks.length) {
    const hunk = session.hunks[index];
    // under the line the pointer is on
    showCard(rect, false, {
      kind: "fix",
      text,
      field: fieldId,
      index,
      removed: text.slice(hunk.start, hunk.end),
      added: hunk.replacement,
    });
  } else {
    const { start, end } = session.long[index - session.hunks.length];
    showCard(union(marks[index] ?? []), false, {
      kind: "offer",
      field: fieldId,
      sentence: { start, end, text: text.slice(start, end) },
    });
  }
};

const onText = (next: string) => {
  text = next;
  hideCard();
  // a fix was just applied: the other fixes still hold, no new call
  const keep = next === expected;
  expected = null;
  session.edit(next, { keep });
};

// Reuses the mark elements from tick to tick, so they only draw in when they're new.
const drawLayer = (layer: HTMLElement, groups: Rect[][], offset: number) => {
  const pool = layer.children as HTMLCollectionOf<HTMLElement>;
  let count = 0;
  groups.forEach((rects, i) => {
    for (const r of rects) {
      const mark = pool[count++] ?? layer.appendChild(Object.assign(document.createElement("div"), { className: "aig-root aig-mark" }));
      Object.assign(mark.style, { display: "block", left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
      // staggers the draw-in, capped so long texts don't take seconds
      mark.style.setProperty("--aig-i", `${Math.min(i, 8)}`);
      mark.toggleAttribute("data-active", offset + i === shown);
    }
  });
  for (let i = count; i < pool.length; i++) {
    pool[i].style.display = "none";
  }
};

const draw = () => {
  // until a tick brings the rects of the new ranges, the long sentences stay where they were
  // drawn rather than flicker, and the old fixes go
  const fixes = session.hunks.length;
  if (marks.length !== fixes + session.long.length) {
    drawLayer(layers.fix, [], 0);
    return;
  }
  drawLayer(layers.fix, marks.slice(0, fixes), 0);
  drawLayer(layers.rewrite, marks.slice(fixes), fixes);
  badge.toggleAttribute("data-hover", hovered === PANEL);
};

// The pointer is tracked by Rust, since this window lets the mouse through.
const hover = ({ cursor: [x, y], overCard }: Tick) => {
  // fixes come first, so they win over the long sentence around them
  let index = NONE;
  let rect = field;
  // the card covers the text under it: nothing there opens another card
  (overCard ? [] : marks).some((rects, i) => {
    const hit = rects.find((r) => inside(r, x, y, 3));
    if (hit) {
      [index, rect] = [i, hit];
    }
    return hit;
  });
  if (index === NONE && !badge.hidden && inside(badge.getBoundingClientRect(), x, y)) {
    index = PANEL;
  }
  setClickable(index === PANEL);
  if (index !== NONE || overCard) {
    clearTimeout(hideTimer);
    hideTimer = undefined;
  } else if (shown !== NONE && hideTimer === undefined) {
    // delayed so the pointer can travel from the text to the card
    hideTimer = setTimeout(() => {
      hideTimer = undefined;
      hideCard();
    }, 300);
  }
  if (index === hovered) {
    return;
  }
  hovered = index;
  clearTimeout(hoverTimer);
  if (index !== NONE) {
    // the panel opens at once, as in the extension; a mark after a short rest, so sweeping
    // across the text doesn't flash cards
    hoverTimer = setTimeout(() => open(index, rect), index === PANEL ? 0 : 250);
  }
};

const acceptAll = async () => {
  const result = session.result;
  if (text === null || result === null || result === text) {
    return;
  }
  // the whole text is replaced by the corrected one
  const before = text;
  expected = result;
  const done = await invoke<boolean>("apply_fix", { field: fieldId, start: 0, end: before.length, replacement: result, expected: before });
  if (!done) {
    expected = null;
  }
};

const accept = async (hunk: Hunk) => {
  if (text === null) {
    return;
  }
  // set before the call: the tick with the new text can arrive before its reply
  const before = text;
  expected = before.slice(0, hunk.start) + hunk.replacement + before.slice(hunk.end);
  const done = await invoke<boolean>("apply_fix", {
    field: fieldId,
    start: hunk.start,
    end: hunk.end,
    replacement: hunk.replacement,
    expected: before,
  });
  if (!done) {
    expected = null;
  }
};

listen<Tick>("tick", ({ payload }) => {
  app = payload.app;
  if (payload.text === null) {
    text = null;
    session.stop();
    clearTimeout(hoverTimer);
    clearTimeout(hideTimer);
    hideTimer = undefined;
    hovered = NONE;
    shown = NONE;
    marks = [];
    layers.fix.replaceChildren();
    layers.rewrite.replaceChildren();
    setBadge("hidden");
    setClickable(false);
    return;
  }
  field = payload.field;
  const moved = payload.id !== fieldId;
  fieldId = payload.id;
  // before the hover test, which reads where the badge is
  placeBadge(field);
  if (moved) {
    layers.rewrite.replaceChildren();
  }
  if (payload.text !== text || moved) {
    onText(payload.text);
  }
  // a tick measured before the new ranges reached Rust keeps the marks drawn
  if (payload.marks.length === session.hunks.length + session.long.length) {
    marks = payload.marks;
  }
  hover(payload);
  draw();
});

// the extension accepts every fix from its trigger
badge.addEventListener("click", () => {
  if (badge.dataset.state === "wrong") {
    acceptAll();
  }
});

// also sent by the card when it turns into a rewrite, which stays until it's used or closed
await listen<number>("card-hidden", ({ payload }) => {
  shown = NONE;
  cardEpoch = Math.max(cardEpoch, payload);
  // a card opened under the pointer meanwhile was refused as stale: the next tick opens it again
  hovered = NONE;
  clearTimeout(hoverTimer);
});
// read after listening, so a takeover in between isn't missed: the page may be a reload after
// the epoch moved on
cardEpoch = Math.max(cardEpoch, await invoke<number>("card_epoch"));

type FixAction = { text: string; field: number; index: number; action: "accept" | "ignore" | "word" | "accept-all"; word?: string };
listen<FixAction>(
  "fix-action",
  ({ payload: { text: shownText, field: shownField, index, action, word } }) => {
    shown = NONE;
    // the card was built on another text or field: its index may point to another fix now
    if (shownText !== text || shownField !== fieldId) {
      return;
    }
    const hunk = session.hunks[index];
    if (action === "accept-all") {
      acceptAll();
    } else if (action === "word" && word) {
      // the settings change takes the fix out
      addToDictionary(word);
    } else if (hunk && text !== null) {
      if (action === "accept") {
        accept(hunk);
      } else {
        // "Ignore" refuses this change in every app, as in the extension
        ignoreChange(changeOf(text, hunk));
      }
    }
  },
);

// A provider change invalidates an in-flight answer; dictionary changes keep existing fixes.
onSettingsChange((next) => {
  const modelChanged = next.model !== settings.model || next.provider !== settings.provider || JSON.stringify(next.cloudConfigs) !== JSON.stringify(settings.cloudConfigs);
  settings = next;
  if (text !== null) {
    if (modelChanged) session.edit(text);
    else session.refresh();
  }
});
