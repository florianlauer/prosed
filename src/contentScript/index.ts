import { computePosition, flip, offset, Rect, shift } from "@floating-ui/dom";
// crxjs lists imported CSS in the manifest, so the browser injects it and page CSPs can't block it
import "./overlay.css";
import {
  addToDictionary,
  disableSite,
  loadSettings,
  ignoreChange,
  onSettingsChange,
  Settings,
  defaultSettings,
} from "../settings";
import { formalityLevels, Tone, tones } from "../prompts";
import { formality, rewrite, tonesFor, type Generate, type Rewrite } from "../check";
import { send } from "../messages";
import { CheckSession } from "../session";
import { GEMINI_MODEL } from "../gemini";
import {
  changeOf,
  dictionaryCandidate,
  Hunk,
  markedSpan,
  splitCheckable,
  wholeWords,
  wordCount,
} from "./text";
import { checkIcon, createDiff, powerIcon, rewriteIcon, spinnerIcon } from "./render";

// Kept current by main(); read at event time so changes in the options page apply at once.
let settings: Settings = defaultSettings;

const buttonSize = 24;
const buttonPadding = 8;

const isVisible = (el: HTMLElement, parent: HTMLElement) => {
  const rect = el.getBoundingClientRect();

  // check coords on the left of the button to handle cases with little textarea (twitter)
  const coords = [
    [rect.left - buttonSize - 1, rect.top + 4],
    [rect.right - buttonSize - 1, rect.top + 4],
    [rect.right - buttonSize - 1, rect.bottom - 4],
    [rect.left - buttonSize - 1, rect.bottom - 4],
  ];

  for (let coord of coords) {
    const other = document.elementFromPoint(coord[0], coord[1]);
    if (!(other && (parent === other || parent.contains(other)))) {
      return false;
    }
  }

  return true;
};

const isSpace = (c: string) => /\s/.test(c);

// innerText adds line breaks for blocks/<br> and collapses whitespace, so walk it
// alongside the DOM text nodes to map its offsets to DOM positions.
const textPositions = (root: HTMLElement) => {
  const text = root.innerText;
  const positions: ([Text, number] | undefined)[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let i = 0;

  for (let node; (node = walker.nextNode() as Text | null); ) {
    for (let j = 0; j < node.data.length; j++) {
      const c = node.data[j];
      while (i < text.length && text[i] === "\n" && c !== "\n") i++;
      if (i < text.length && (text[i] === c || (isSpace(text[i]) && isSpace(c)))) {
        positions[i++] = [node, j];
      }
    }
  }
  return positions;
};

// The innerText offsets of the characters a DOM range covers.
const offsetsOfRange = (root: HTMLElement, range: Range) => {
  let start = -1;
  let end = -1;
  textPositions(root).forEach((p, i) => {
    if (p && range.comparePoint(p[0], p[1]) === 0 && range.comparePoint(p[0], p[1] + 1) === 0) {
      if (start === -1) start = i;
      end = i + 1;
    }
  });
  return start === -1 ? null : { start, end };
};

const rangeFromOffsets = (root: HTMLElement, start: number, end: number) => {
  const positions = textPositions(root);

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);

  // prefer "right after the previous char" so insertions stay in the current block
  const prev = positions[start - 1];
  const next = positions.findIndex((p, k) => k >= start && p !== undefined);
  if (prev) {
    range.setStart(prev[0], prev[1] + 1);
  } else if (next !== -1) {
    range.setStart(...positions[next]!);
  }
  range.collapse(true);

  for (let k = end - 1; k >= start; k--) {
    const p = positions[k];
    if (p) {
      range.setEnd(p[0], p[1] + 1);
      break;
    }
  }

  return range;
};

const replaceText = (
  el: HTMLTextAreaElement | HTMLElement,
  { start, end, replacement }: Hunk,
) => {
  el.focus();

  let range: Range | null = null;
  if (el instanceof HTMLTextAreaElement) {
    el.setSelectionRange(start, end);
  } else {
    range = rangeFromOffsets(el, start, end);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // execCommand keeps native undo and goes through the editor's own input handling (React, Lexical, ProseMirror...)
  const ok = replacement
    ? document.execCommand("insertText", false, replacement)
    : document.execCommand("delete");
  if (ok) {
    return;
  }

  if (el instanceof HTMLTextAreaElement) {
    el.setRangeText(replacement, start, end, "end");
  } else if (range) {
    range.deleteContents();
    range.insertNode(document.createTextNode(replacement));
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

// A model backend, reached through the service worker, which keeps an abort controller per channel.
type Provider = { name: string; isSupported: () => Promise<boolean>; generate: Generate };

const gemini: Provider = {
  name: "chrome built-in",
  async isSupported() {
    try {
      return await send({ type: "gemini.supported" });
    } catch (e) {
      console.warn(e);
      return false;
    }
  },

  async generate({ channel, prompt, schema }) {
    const response = await send({
      type: "gemini.generate",
      channel,
      data: { text: prompt, responseConstraint: schema },
    });

    if (!response) {
      throw new Error("Make sure that Gemini is working");
    }
    if (typeof response !== "string") {
      throw new Error(response.error);
    }
    return JSON.parse(response);
  },
};

const ollama: Provider = {
  name: "ollama",
  async isSupported() {
    try {
      const result = await send({ type: "ollama.list" });

      if (!result) {
        return false;
      }

      return result.models.length > 0;
    } catch (e) {
      console.warn(e);
      return false;
    }
  },

  async generate({ channel, model, prompt, schema }) {
    const response = await send({
      type: "ollama.generate",
      channel,
      data: {
        model,
        prompt,
        format: schema,
        options: { temperature: 0 },
        // keep the model loaded so the first check after a pause isn't slow
        keep_alive: -1,
        // thinking would add seconds per check
        think: false,
      },
    });

    if (!response) {
      throw new Error("Make sure that Ollama is installed and running.");
    }
    if ("error" in response) {
      throw new Error(response.error);
    }
    return JSON.parse(response.response ?? "");
  },
};

// These sites turn native spell checking off because they ship their own checker,
// so spellcheck="false" there doesn't mean "not prose".
const spellcheckOffAllowed = ["mail.google.com"];

const isTextArea = (
  node: Node | EventTarget,
): node is HTMLTextAreaElement | HTMLElement => {
  return (
    ((node instanceof HTMLElement && node.contentEditable === "true") ||
      node instanceof HTMLTextAreaElement) &&
    (node.spellcheck || spellcheckOffAllowed.includes(location.hostname))
  );
};

// Set localStorage["prosed:debug"] = "1" on a site to trace why a field is or isn't checked.
const debug = (...args: unknown[]) => {
  if (localStorage.getItem("prosed:debug")) {
    console.log("[prosed]", ...args);
  }
};

const describe = (el: Element | null | undefined) =>
  el
    ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${[...el.classList].slice(0, 3).join(".")}`
    : String(el);

// Some editors (Notion) make the whole page one editing host, page UI included,
// with each block as a nested contenteditable. Check the block around the caret.
const checkUnit = (target: HTMLTextAreaElement | HTMLElement) => {
  if (target instanceof HTMLTextAreaElement) {
    return target;
  }
  const anchor = getSelection()?.anchorNode;
  const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
  const block = anchorEl?.closest<HTMLElement>('[contenteditable="true"]');
  if (block && block !== target && target.contains(block) && isTextArea(block)) {
    return block;
  }
  // page UI inside the host means the host is a whole page: wait until the caret is in a block
  if (target.querySelector('[contenteditable="false"]')) {
    debug("skip: page-level editor and caret not in a block", describe(anchorEl));
    return null;
  }
  return target;
};

const recursivelyFindAllTextAreas = (node: Node) => {
  const inputs: (HTMLTextAreaElement | HTMLElement)[] = [];
  if (isTextArea(node)) {
    inputs.push(node);
  } else {
    for (let child of node.childNodes) {
      inputs.push(...recursivelyFindAllTextAreas(child));
    }
  }
  return inputs;
};

type PanelContent = {
  title: string;
  body: string | DocumentFragment;
  muted?: boolean;
  action?: { label: string; onClick: () => void };
};

// The panel listing every suggestion, opened from the trigger.
class Tooltip {
  #tooltip: HTMLDivElement;
  #button: HTMLButtonElement;
  #title: HTMLSpanElement;
  #action: HTMLButtonElement;
  #body: HTMLDivElement;
  #onAction: (() => void) | null = null;

  constructor(button: HTMLButtonElement) {
    this.#button = button;
    this.#tooltip = document.createElement("div");
    this.#tooltip.className = "aig-root aig-pop aig-panel";
    this.#tooltip.role = "dialog";
    this.#tooltip.ariaLabel = "Grammar suggestions";

    const head = document.createElement("div");
    head.className = "aig-panel__head";
    this.#title = document.createElement("span");
    this.#title.className = "aig-panel__title";
    this.#action = document.createElement("button");
    this.#action.type = "button";
    this.#action.className = "aig-action";
    this.#action.hidden = true;
    this.#action.addEventListener("click", () => this.#onAction?.());
    head.append(this.#title, this.#action);

    this.#body = document.createElement("div");
    this.#body.className = "aig-panel__body";

    const foot = document.createElement("div");
    foot.className = "aig-panel__foot";
    const settingsLink = document.createElement("button");
    settingsLink.type = "button";
    settingsLink.className = "aig-link";
    settingsLink.textContent = "Settings";
    settingsLink.addEventListener("click", () =>
      send({ type: "options.open" }),
    );
    const siteOff = document.createElement("button");
    siteOff.type = "button";
    siteOff.className = "aig-link";
    siteOff.textContent = `Turn off on ${location.hostname}`;
    siteOff.addEventListener("click", () => void disableSite(location.hostname));
    foot.append(settingsLink, siteOff);

    this.#tooltip.append(head, this.#body, foot);
    document.body.appendChild(this.#tooltip);
  }

  get element() {
    return this.#tooltip;
  }

  show() {
    this.#tooltip.dataset.open = "";
    this.#updateTooltipPosition();
  }

  hide() {
    delete this.#tooltip.dataset.open;
  }

  set content({ title, body, muted, action }: PanelContent) {
    this.#title.textContent = title;
    this.#body.replaceChildren(...(body ? [body] : []));
    this.#tooltip.toggleAttribute("data-muted", !!muted);
    this.#action.hidden = !action;
    this.#action.textContent = action?.label ?? "";
    this.#onAction = action?.onClick ?? null;
    this.#updateTooltipPosition();
  }

  #updateTooltipPosition() {
    computePosition(this.#button, this.#tooltip, {
      placement: "bottom-end",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y, placement }) => {
      Object.assign(this.#tooltip.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
      this.#tooltip.dataset.side = placement;
    });
  }

  destroy() {
    this.#tooltip.remove();
  }
}

// Light text means a dark surface. Follows the host input rather than the OS, since a dark
// overlay on a light page (or the reverse) looks foreign.
const themeFor = (el: HTMLElement) => {
  const color = getComputedStyle(el).color;
  const [a = 0, b = 0, c = 0] = color.match(/[\d.]+/g)?.map(Number) ?? [];
  let lightness: number;
  if (color.startsWith("rgb")) {
    lightness = (0.2126 * a + 0.7152 * b + 0.0722 * c) / 255;
  } else if (/^(ok)?l(ch|ab)\(/.test(color)) {
    lightness = a > 1 ? a / 100 : a;
  } else {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return lightness > 0.5 ? "dark" : "light";
};

// Layout properties a mirror div needs to wrap text exactly like its textarea.
const mirroredProps = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "textAlign",
  "wordSpacing",
  "tabSize",
  "direction",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
] as const;

type Underline = { hunk: Hunk; range: Range; rects: DOMRect[] };

// Draws suggestion underlines over the input. Textareas can't style their own text, so a
// hidden mirror div with the same layout gives the text positions; contenteditables use
// ranges on their own DOM. Lines are overlay divs so the editor's DOM is never touched.
class Underlines {
  #el: HTMLTextAreaElement | HTMLElement;
  #mirror: HTMLDivElement | null = null;
  #layer: HTMLDivElement;
  #items: Underline[] = [];
  #active: Hunk | null = null;

  // "fix" for mistakes, "rewrite" for long sentences, drawn in another colour
  constructor(el: HTMLTextAreaElement | HTMLElement, kind: "fix" | "rewrite" = "fix") {
    this.#el = el;
    this.#layer = document.createElement("div");
    this.#layer.className = "aig-root aig-layer";
    this.#layer.dataset.kind = kind;
    document.body.appendChild(this.#layer);
  }

  // animate=false re-anchors the same marks after an edit without replaying their draw-in
  set(text: string, hunks: Hunk[], animate = true) {
    let textNode: Text | null = null;
    if (this.#el instanceof HTMLTextAreaElement) {
      this.#mirror ??= createMirror();
      copyTextareaStyle(this.#el, this.#mirror);
      // trailing space keeps a final empty line, so the max scroll matches the textarea
      this.#mirror.textContent = text + " ";
      textNode = this.#mirror.firstChild as Text;
    }

    this.#items = hunks.map((hunk) => {
      const [start, end] = markedSpan(text, hunk);
      let range: Range;
      if (textNode) {
        range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
      } else {
        range = rangeFromOffsets(this.#el, start, end);
      }
      return { hunk, range, rects: [] };
    });

    // hide then reflow, so reused marks replay their draw-in animation for the new result
    this.#active = null;
    if (animate) {
      for (const mark of this.#layer.children as HTMLCollectionOf<HTMLElement>) {
        mark.style.display = "none";
      }
      void this.#layer.offsetWidth;
    }
    this.draw();
  }

  clear() {
    this.#items = [];
    this.#active = null;
    this.draw();
  }

  get element() {
    return this.#layer;
  }

  setActive(hunk: Hunk | null) {
    this.#active = hunk;
    this.draw();
  }

  draw() {
    const lines = this.#layer.children as HTMLCollectionOf<HTMLDivElement>;
    let count = 0;

    if (this.#items.length > 0) {
      if (this.#el instanceof HTMLTextAreaElement && this.#mirror) {
        syncMirror(this.#el, this.#mirror);
      }
      const box = this.#el.getBoundingClientRect();

      for (const [index, item] of this.#items.entries()) {
        // skip text scrolled out of the input
        item.rects = [...item.range.getClientRects()].filter(
          (r) =>
            r.width > 0 &&
            r.bottom > box.top &&
            r.top < box.bottom &&
            r.right > box.left &&
            r.left < box.right,
        );
        for (const r of item.rects) {
          const mark = lines[count++] ?? this.#layer.appendChild(this.#createMark());
          Object.assign(mark.style, {
            display: "block",
            left: `${r.left}px`,
            top: `${r.top}px`,
            width: `${r.width}px`,
            height: `${r.height}px`,
          });
          // staggers the draw-in, capped so long texts don't take seconds
          mark.style.setProperty("--aig-i", `${Math.min(index, 8)}`);
          mark.toggleAttribute("data-active", item.hunk === this.#active);
        }
      }
    }

    for (let i = count; i < lines.length; i++) {
      lines[i].style.display = "none";
    }
  }

  // The box around the nth item, to anchor a popover under all of it.
  bounds(index: number) {
    return this.#items[index].range.getBoundingClientRect();
  }

  // Suggestion under the pointer, with the rect it was found in.
  at(x: number, y: number) {
    for (const item of this.#items) {
      for (const rect of item.rects) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom + 3) {
          return { hunk: item.hunk, rect };
        }
      }
    }
    return null;
  }

  destroy() {
    this.#layer.remove();
    this.#mirror?.remove();
  }

  #createMark() {
    const mark = document.createElement("div");
    mark.className = "aig-root aig-mark";
    return mark;
  }
}

const createMirror = () => {
  const mirror = document.createElement("div");
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    overflow: "hidden",
    pointerEvents: "none",
    margin: "0",
    borderColor: "transparent",
    boxSizing: "border-box",
  });
  document.body.appendChild(mirror);
  return mirror;
};

const copyTextareaStyle = (textarea: HTMLTextAreaElement, mirror: HTMLDivElement) => {
  const style = getComputedStyle(textarea);
  for (const prop of mirroredProps) {
    mirror.style[prop] = style[prop];
  }
  // a visible scrollbar narrows the textarea's text area; the mirror has none
  const scrollbar =
    textarea.offsetWidth -
    textarea.clientWidth -
    parseFloat(style.borderLeftWidth) -
    parseFloat(style.borderRightWidth);
  mirror.style.paddingRight = `${parseFloat(style.paddingRight) + scrollbar}px`;
};

const syncMirror = (textarea: HTMLTextAreaElement, mirror: HTMLDivElement) => {
  const rect = textarea.getBoundingClientRect();
  Object.assign(mirror.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
};

// Where a span of a textarea's text is on screen, measured on a throwaway mirror.
const textareaRects = (textarea: HTMLTextAreaElement, start: number, end: number) => {
  const mirror = createMirror();
  copyTextareaStyle(textarea, mirror);
  mirror.textContent = textarea.value + " ";
  syncMirror(textarea, mirror);
  const range = document.createRange();
  range.setStart(mirror.firstChild!, start);
  range.setEnd(mirror.firstChild!, end);
  const rects = [...range.getClientRects()];
  mirror.remove();
  return rects;
};

// Small popup shown when hovering an underlined word.
class SuggestionCard {
  #card: HTMLDivElement;
  #hunk: Hunk | null = null;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private onApply: (hunk: Hunk) => void,
    private onActiveChange: (hunk: Hunk | null) => void,
    private onAddWord: (word: string) => void,
    private onIgnore: (hunk: Hunk) => void,
  ) {
    this.#card = document.createElement("div");
    this.#card.className = "aig-root aig-pop aig-card";
    this.#card.role = "dialog";
    this.#card.ariaLabel = "Suggestion";
    // keep focus and selection in the input while clicking the suggestion
    this.#card.addEventListener("mousedown", (e) => e.preventDefault());
    document.body.appendChild(this.#card);
  }

  get element() {
    return this.#card;
  }

  show(hunk: Hunk, removed: string, anchor: DOMRect) {
    clearTimeout(this.#hideTimer);
    if (this.#hunk === hunk) {
      return;
    }
    this.#hunk = hunk;
    this.onActiveChange(hunk);

    // whitespace-only changes would otherwise render as an empty label
    const quoted = (s: string) => `“${s.trim() || "space"}”`;
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "aig-card__apply";
    apply.addEventListener("click", () => {
      this.hide();
      this.onApply(hunk);
    });

    const children: HTMLElement[] = [];
    if (removed && hunk.replacement) {
      const was = document.createElement("div");
      was.className = "aig-card__was";
      was.textContent = removed;
      children.push(was);
      apply.textContent = hunk.replacement;
    } else if (removed) {
      apply.textContent = `Remove ${quoted(removed)}`;
    } else {
      apply.textContent = `Add ${quoted(hunk.replacement)}`;
    }
    children.push(apply);

    const secondary = (label: string, onClick: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "aig-card__secondary";
      button.textContent = label;
      button.addEventListener("click", () => {
        this.hide();
        onClick();
      });
      return button;
    };
    const word = dictionaryCandidate(removed);
    if (word) {
      children.push(secondary(`Add ${quoted(word)} to dictionary`, () => this.onAddWord(word)));
    }
    children.push(secondary("Ignore", () => this.onIgnore(hunk)));
    this.#card.replaceChildren(...children);
    this.#card.dataset.open = "";

    computePosition({ getBoundingClientRect: () => anchor }, this.#card, {
      placement: "bottom-start",
      strategy: "fixed",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y, placement }) => {
      Object.assign(this.#card.style, { left: `${x}px`, top: `${y}px` });
      this.#card.dataset.side = placement;
    });
  }

  // delayed so the pointer can travel from the word to the card
  scheduleHide() {
    if (!this.#hunk) {
      return;
    }
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => this.hide(), 200);
  }

  keep() {
    clearTimeout(this.#hideTimer);
  }

  hide() {
    clearTimeout(this.#hideTimer);
    if (this.#hunk) {
      this.#hunk = null;
      this.onActiveChange(null);
    }
    delete this.#card.dataset.open;
  }

  contains(target: EventTarget | null) {
    return target instanceof Node && this.#card.contains(target);
  }

  destroy() {
    clearTimeout(this.#hideTimer);
    this.#card.remove();
  }
}

// A span of the checked text to rewrite, with the text it had when picked.
type RewriteTarget = { start: number; end: number; text: string };

// The popup with rewrite variants. Hovering a long sentence only offers a rewrite, so
// passing the pointer over text never costs a model call; a click runs it. Once open, the
// card says how formal the text sounds and switches between tone presets.
class RewriteCard {
  #card: HTMLDivElement;
  #body: HTMLDivElement | null = null;
  #chips: HTMLButtonElement[] = [];
  #target: RewriteTarget | null = null;
  #anchor: (() => DOMRect) | null = null;
  // an offer follows the pointer like the suggestion card; a running or finished rewrite stays
  #pinned = false;
  // bumped per request, and per target so a late formality answer can't land on another text
  #run = 0;
  #session = 0;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private rewrite: (target: RewriteTarget, tone: Tone) => Promise<Rewrite>,
    private onApply: (target: RewriteTarget, variant: string) => void,
    private formality: (text: string) => Promise<number>,
  ) {
    this.#card = document.createElement("div");
    this.#card.className = "aig-root aig-pop aig-card aig-card--rewrite";
    this.#card.role = "dialog";
    this.#card.ariaLabel = "Rewrite";
    // keep focus and selection in the input while clicking a variant
    this.#card.addEventListener("mousedown", (e) => e.preventDefault());
    document.body.appendChild(this.#card);
  }

  get element() {
    return this.#card;
  }

  get isOpen() {
    return this.#target !== null;
  }

  get isPinned() {
    return this.#pinned;
  }

  offer(target: RewriteTarget, anchor: () => DOMRect) {
    clearTimeout(this.#hideTimer);
    if (this.#pinned || this.#target?.start === target.start) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aig-card__rewrite";
    button.innerHTML = rewriteIcon;
    button.append("Rewrite this sentence");
    button.addEventListener("click", () => this.open(target, anchor));
    this.#show(target, anchor, [this.#label(`Long sentence, ${wordCount(target.text)} words`), button]);
  }

  async open(target: RewriteTarget, anchor: () => DOMRect, tone: Tone = "clearer") {
    clearTimeout(this.#hideTimer);
    // a tone chip keeps the card, its meter and its chips, and only replaces the variants
    let meter: HTMLDivElement | null = null;
    if (!this.#pinned || this.#target !== target) {
      this.#pinned = true;
      ++this.#session;
      meter = document.createElement("div");
      meter.className = "aig-meter";
      meter.hidden = true;
      const chips = document.createElement("div");
      chips.className = "aig-chips";
      chips.role = "group";
      chips.ariaLabel = "Tone";
      this.#chips = tonesFor(target.text).map((t) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "aig-chip";
        chip.dataset.tone = t;
        chip.textContent = tones[t].label;
        chip.addEventListener("click", () => this.open(target, anchor, t));
        return chip;
      });
      chips.append(...this.#chips);
      this.#body = document.createElement("div");
      this.#body.className = "aig-card__body";
      this.#show(target, anchor, [meter, chips, this.#body]);
    }
    for (const chip of this.#chips) {
      chip.ariaPressed = String(chip.dataset.tone === tone);
    }

    const run = ++this.#run;
    this.#setBody([this.#label("Rewriting…", true)]);

    const rewriting = this.rewrite(target, tone);
    // sent after the rewrite, so an Ollama that runs one request at a time answers the rewrite first
    if (meter) {
      this.#measure(target.text, meter, this.#session);
    }
    let result: Rewrite;
    try {
      result = await rewriting;
    } catch (e) {
      console.warn(e);
      if (run === this.#run) {
        this.#setBody([this.#note("The rewrite failed. Check that the model is running.")]);
      }
      return;
    }
    if (run !== this.#run) {
      return;
    }
    const { variants, notes } = result;
    // false friends are worth reading even when no variant made it
    const noteList = notes.length
      ? [this.#label("Words to check"), ...notes.map((n) => this.#note(n))]
      : [];
    if (variants.length === 0) {
      this.#setBody([
        this.#note("No rewrite kept every name, number and link, so none is shown. Try a shorter selection."),
        ...noteList,
      ]);
      return;
    }
    this.#setBody([
      this.#label(tone === "clearer" ? "Rewrites" : tones[tone].label),
      ...variants.map((variant) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "aig-card__variant";
        button.textContent = variant;
        button.addEventListener("click", () => {
          this.hide();
          this.onApply(target, variant);
        });
        return button;
      }),
      ...noteList,
    ]);
  }

  // On its own channel, so it doesn't cancel the rewrite; on failure the line just stays hidden.
  async #measure(text: string, meter: HTMLDivElement, session: number) {
    let level: number;
    try {
      level = await this.formality(text);
    } catch (e) {
      console.warn(e);
      return;
    }
    if (session !== this.#session) {
      return;
    }
    const dots = document.createElement("span");
    dots.className = "aig-meter__dots";
    dots.ariaHidden = "true";
    for (let i = 1; i <= 5; i++) {
      const dot = document.createElement("span");
      dot.toggleAttribute("data-on", i <= level);
      dots.append(dot);
    }
    const name = document.createElement("strong");
    name.textContent = formalityLevels[level - 1];
    meter.replaceChildren("Sounds", dots, name);
    meter.title = `Formality ${level} of 5, from very casual to very formal`;
    meter.hidden = false;
    this.reposition();
  }

  #setBody(children: HTMLElement[]) {
    this.#body?.replaceChildren(...children);
    this.reposition();
  }

  #label(text: string, busy = false) {
    const label = document.createElement("div");
    label.className = "aig-card__label";
    label.toggleAttribute("data-busy", busy);
    label.textContent = text;
    return label;
  }

  #note(text: string) {
    const note = document.createElement("p");
    note.className = "aig-card__note";
    note.textContent = text;
    return note;
  }

  #show(target: RewriteTarget, anchor: () => DOMRect, children: HTMLElement[]) {
    this.#target = target;
    this.#anchor = anchor;
    this.#card.replaceChildren(...children);
    this.#card.dataset.open = "";
    this.reposition();
  }

  reposition() {
    const anchor = this.#anchor;
    if (!anchor) {
      return;
    }
    computePosition({ getBoundingClientRect: anchor }, this.#card, {
      placement: "bottom-start",
      strategy: "fixed",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y, placement }) => {
      Object.assign(this.#card.style, { left: `${x}px`, top: `${y}px` });
      this.#card.dataset.side = placement;
    });
  }

  // delayed so the pointer can travel from the sentence to the card
  scheduleHide() {
    if (!this.#target || this.#pinned) {
      return;
    }
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => this.hide(), 200);
  }

  keep() {
    clearTimeout(this.#hideTimer);
  }

  hide() {
    clearTimeout(this.#hideTimer);
    // a rewrite still running is dropped when it comes back
    this.#run++;
    this.#session++;
    this.#pinned = false;
    this.#target = null;
    this.#anchor = null;
    delete this.#card.dataset.open;
  }

  contains(target: EventTarget | null) {
    return target instanceof Node && this.#card.contains(target);
  }

  destroy() {
    this.hide();
    this.#card.remove();
  }
}

const getButtonVerticalPadding = (rect: Rect) => {
  if (rect.height < buttonSize + buttonPadding * 2) {
    return Math.max(0, rect.height - buttonSize) / 2;
  }

  return buttonPadding;
};

type State =
  | { type: "empty" }
  | { type: "loading" }
  | { type: "correct" }
  | { type: "wrong"; text: DocumentFragment; count: number }
  | { type: "error"; text: string };

class Control {
  #button: HTMLButtonElement;
  #tooltip: Tooltip;

  #session: CheckSession;
  #provider: Provider | null;
  #updateInterval: ReturnType<typeof setInterval> | null = null;
  #isVisible: boolean = false;
  #showButton: boolean = false;
  #applying: boolean = false;
  #hideTimer: ReturnType<typeof setTimeout> | undefined;
  #underlines: Underlines;
  #card: SuggestionCard;
  #glyph: string = "";
  #textObserver: MutationObserver | null = null;
  // sentences over 30 words, underlined in the rewrite colour
  #long: Underlines;
  #longRanges: { start: number; end: number }[] = [];
  #rewriteCard: RewriteCard;
  #rewriteButton: HTMLButtonElement;
  #selection: { target: RewriteTarget; anchor: () => DOMRect } | null = null;
  #selectionTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    public textArea: HTMLTextAreaElement | HTMLElement,
    provider: Provider | null,
  ) {
    this.#provider = provider;
    this.#session = new CheckSession({
      generate: provider?.generate ?? null,
      settings: () => settings,
      pause: 500,
      onChange: () => this.#render(),
    });
    this.#underlines = new Underlines(textArea);
    this.#card = new SuggestionCard(
      (hunk) => this.#applyHunks([hunk]),
      (hunk) => this.#underlines.setActive(hunk),
      (word) => void addToDictionary(word),
      (hunk) => void ignoreChange(changeOf(this.#text, hunk)),
    );
    this.#long = new Underlines(textArea, "rewrite");
    this.#rewriteCard = new RewriteCard(this.#rewrite, this.#applyRewrite, (text) =>
      this.#provider
        ? formality({ text, settings, generate: this.#provider.generate })
        : Promise.reject(new Error("AI is not supported")),
    );
    this.#rewriteButton = document.createElement("button");
    this.#rewriteButton.type = "button";
    this.#rewriteButton.className = "aig-root aig-rewrite-button";
    this.#rewriteButton.innerHTML = rewriteIcon;
    this.#rewriteButton.append("Rewrite");
    // keep the selection: it is what gets replaced
    this.#rewriteButton.addEventListener("mousedown", (e) => e.preventDefault());
    this.#rewriteButton.addEventListener("click", () => {
      const selection = this.#selection;
      delete this.#rewriteButton.dataset.open;
      if (selection) {
        this.#rewriteCard.open(selection.target, selection.anchor);
      }
    });
    document.body.appendChild(this.#rewriteButton);
    document.addEventListener("selectionchange", this.#scheduleSelection);
    for (const type of ["select", "mouseup", "keyup"]) {
      textArea.addEventListener(type, this.#scheduleSelection);
    }
    document.addEventListener("mousedown", this.#handleMouseDown, true);
    document.addEventListener("keydown", this.#handleKeyDown, true);
    document.addEventListener("mousemove", this.#handleMouseMove, { passive: true });
    // capture: scrolls inside any container move the text too
    window.addEventListener("scroll", this.#handleScroll, { capture: true, passive: true });
    this.#button = document.createElement("button");
    this.#button.type = "button";
    this.#button.className = "aig-root aig-trigger";
    this.#button.style.zIndex = "2147483647";
    this.#setGlyph(spinnerIcon, "Checking grammar");
    document.body.appendChild(this.#button);
    this.#tooltip = new Tooltip(this.#button);

    const theme = themeFor(textArea);
    for (const el of [
      this.#button,
      this.#tooltip.element,
      this.#card.element,
      this.#underlines.element,
      this.#long.element,
      this.#rewriteCard.element,
      this.#rewriteButton,
    ]) {
      el.dataset.theme = theme;
    }

    this.updatePosition();

    this.#button.addEventListener("mouseenter", () => this.#showTooltip());
    this.#button.addEventListener("mouseleave", () => this.#hideTooltip());
    this.#button.addEventListener("focus", () => this.#showTooltip());
    this.#button.addEventListener("blur", () => this.#hideTooltip());

    const tooltip = this.#tooltip.element;
    tooltip.addEventListener("mouseenter", () => this.#showTooltip());
    tooltip.addEventListener("mouseleave", () => this.#hideTooltip());
    // keep focus and selection in the input while clicking suggestions
    tooltip.addEventListener("mousedown", (e) => e.preventDefault());

    this.#updateInterval = setInterval(() => {
      control?.updatePosition();
    }, 60);

    // some editors (Notion) apply deletions themselves without firing "input"
    if (!(textArea instanceof HTMLTextAreaElement)) {
      this.#textObserver = new MutationObserver(() => {
        if (!this.#applying && this.#readText() !== this.#text) {
          this.update();
        }
      });
      this.#textObserver.observe(textArea, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  #showTooltip() {
    clearTimeout(this.#hideTimer);
    // a correct text still has the tone presets
    if (this.#isCorrect && !this.#provider) {
      return;
    }
    this.#tooltip.show();
  }

  // delayed so the pointer can travel from the button to the tooltip
  #hideTooltip() {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => this.#tooltip.hide(), 200);
  }

  #handleMouseMove = (e: MouseEvent) => {
    if (this.#card.contains(e.target)) {
      this.#card.keep();
      return;
    }
    if (this.#rewriteCard.contains(e.target)) {
      this.#rewriteCard.keep();
      return;
    }
    // fixes are drawn over long sentences, so they win
    const hit = this.#underlines.at(e.clientX, e.clientY);
    if (hit) {
      const removed = this.#text.slice(hit.hunk.start, hit.hunk.end);
      this.#card.show(hit.hunk, removed, hit.rect);
      this.#rewriteCard.scheduleHide();
      return;
    }
    this.#card.scheduleHide();
    const long = this.#long.at(e.clientX, e.clientY);
    if (long) {
      const { start, end } = long.hunk;
      const index = this.#longRanges.findIndex((r) => r.start === start);
      this.#rewriteCard.offer({ start, end, text: this.#text.slice(start, end) }, () =>
        this.#long.bounds(index),
      );
    } else {
      this.#rewriteCard.scheduleHide();
    }
  };

  #handleScroll = () => {
    this.#underlines.draw();
    this.#long.draw();
    this.#card.hide();
    // a rewrite the user asked for follows its text instead of being thrown away
    if (this.#rewriteCard.isPinned) {
      this.#rewriteCard.reposition();
    } else {
      this.#rewriteCard.hide();
    }
    this.#hideRewriteButton();
  };

  #handleMouseDown = (e: MouseEvent) => {
    const t = e.target;
    if (!this.#rewriteCard.contains(t) && !(t instanceof Node && this.#rewriteButton.contains(t))) {
      this.#rewriteCard.hide();
    }
  };

  #handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (this.#rewriteCard.isOpen || this.#selection)) {
      // the page would otherwise also cancel an edit or close its dialog
      e.preventDefault();
      e.stopPropagation();
      this.#rewriteCard.hide();
      this.#hideRewriteButton();
    }
  };

  #scheduleSelection = () => {
    clearTimeout(this.#selectionTimer);
    this.#selectionTimer = setTimeout(this.#updateSelection, 120);
  };

  #hideRewriteButton() {
    this.#selection = null;
    delete this.#rewriteButton.dataset.open;
  }

  // Shows "Rewrite" under a selection of two words or more inside the checked field.
  #updateSelection = () => {
    const target = this.#provider && !this.#rewriteCard.isOpen ? this.#selectedTarget() : null;
    const el = this.textArea;
    // measured again on scroll, so the card can follow the text
    const range = !target || el instanceof HTMLTextAreaElement ? null : getSelection()!.getRangeAt(0).cloneRange();
    const anchor = () =>
      (range ? [...range.getClientRects()] : textareaRects(el as HTMLTextAreaElement, target!.start, target!.end))
        .filter((r) => r.width > 0)
        .at(-1) ?? new DOMRect();
    const rect = target && anchor();
    if (!target || !rect?.width) {
      this.#hideRewriteButton();
      return;
    }
    this.#selection = { target, anchor };
    computePosition({ getBoundingClientRect: anchor }, this.#rewriteButton, {
      placement: "bottom-end",
      strategy: "fixed",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      Object.assign(this.#rewriteButton.style, { left: `${x}px`, top: `${y}px` });
      this.#rewriteButton.dataset.open = "";
    });
  };

  #selectedTarget(): RewriteTarget | null {
    const el = this.textArea;
    let offsets: { start: number; end: number } | null;
    if (el instanceof HTMLTextAreaElement) {
      offsets =
        document.activeElement === el ? { start: el.selectionStart, end: el.selectionEnd } : null;
    } else {
      const selection = getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      offsets =
        range && !range.collapsed && el.contains(range.commonAncestorContainer)
          ? offsetsOfRange(el, range)
          : null;
    }
    if (!offsets) {
      return null;
    }
    // the variants replace whole words, so a word cut by the selection isn't left half there
    const all = this.#readText();
    const { start, end } = wholeWords(all, offsets.start, offsets.end);
    const text = all.slice(start, end);
    return wordCount(text) >= 2 ? { start, end, text } : null;
  }

  #rewrite = async ({ start, end, text }: RewriteTarget, tone: Tone): Promise<Rewrite> => {
    if (!this.#provider) {
      throw new Error("AI is not supported");
    }
    return rewrite({ text, tone, settings, field: { text: this.#text, start }, generate: this.#provider.generate });
  };

  #applyRewrite = ({ start, end, text }: RewriteTarget, variant: string) => {
    // the text may have changed while the model was writing
    if (this.#readText().slice(start, end) !== text) {
      return;
    }
    // the selection may include the spaces around the sentence; the variant doesn't
    const lead = text.match(/^\s*/)![0];
    const trail = text.match(/\s*$/)![0];
    // not #applying: the text changed, so it needs a new check
    replaceText(this.textArea, { start, end, replacement: lead + variant + trail });
  };

  #setLong() {
    const ranges = this.#session.long;
    const changed = JSON.stringify(ranges) !== JSON.stringify(this.#longRanges);
    this.#longRanges = ranges;
    this.#long.set(
      this.#text,
      ranges.map((r) => ({ ...r, replacement: "" })),
      changed,
    );
  }

  // The panel lists fixes and rewrites under their own label once there are both kinds.
  #panelBody(fixes: DocumentFragment | null) {
    if (!this.#provider) {
      return fixes ?? "";
    }
    const label = (text: string, kind: string) => {
      const el = document.createElement("div");
      el.className = "aig-section";
      el.dataset.kind = kind;
      el.textContent = text;
      return el;
    };
    const body = document.createDocumentFragment();
    if (fixes) {
      const text = document.createElement("div");
      text.append(fixes);
      body.append(label("Fixes", "fix"), text);
    }
    if (this.#longRanges.length) {
      body.append(label("Rewrites", "rewrite"));
    }
    this.#longRanges.forEach(({ start, end }, i) => {
      const text = this.#text.slice(start, end);
      const item = document.createElement("button");
      item.type = "button";
      item.className = "aig-rewrite-item";
      item.textContent = `${text.split(/\s+/).slice(0, 6).join(" ")}… (${wordCount(text)} words)`;
      item.title = "Rewrite this sentence";
      item.addEventListener("click", () => {
        this.#tooltip.hide();
        this.#rewriteCard.open({ start, end, text }, () => this.#long.bounds(i));
      });
      body.append(item);
    });

    // the tone presets for the whole field, signature and blank lines left out like the check
    const { before, core } = splitCheckable(this.#text);
    const whole = { start: before.length, end: before.length + core.length, text: core };
    const chips = document.createElement("div");
    chips.className = "aig-chips";
    chips.role = "group";
    chips.ariaLabel = "Tone of the whole text";
    for (const tone of tonesFor(core)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "aig-chip";
      chip.textContent = tones[tone].label;
      chip.addEventListener("click", () => {
        this.#tooltip.hide();
        this.#rewriteCard.open(whole, () => this.textArea.getBoundingClientRect(), tone);
      });
      chips.append(chip);
    }
    body.append(label("Whole text", "rewrite"), chips);
    return body;
  }

  #setState(state: State) {
    debug("state", state.type, state.type === "error" ? state.text : "");
    // offsets are only valid for the text they were computed on
    if (state.type !== "wrong") {
      this.#underlines.clear();
      this.#card.hide();
    }

    this.#button.dataset.state = state.type;
    this.#button.removeEventListener("click", this.#handleWrongClick);
    this.#button.removeEventListener("click", this.#handleErrorClick);

    switch (state.type) {
      case "empty":
        this.#hide();
        clearTimeout(this.#hideTimer);
        this.#tooltip.hide();
        // the hidden panel's chips would still rewrite the previous text
        this.#tooltip.content = { title: "", body: "" };
        return;
      case "loading":
        this.#show();
        this.#setGlyph(spinnerIcon, "Checking grammar");
        this.#tooltip.content = { title: "Checking…", body: "" };
        return;
      case "correct":
        this.#show();
        this.#setGlyph(checkIcon, "No suggestions");
        this.#tooltip.content = { title: "No fixes", body: this.#panelBody(null) };
        return;
      case "wrong": {
        const title = `${state.count} ${state.count === 1 ? "suggestion" : "suggestions"}`;
        this.#show();
        this.#setGlyph(
          `<span class="aig-count">${state.count}</span>`,
          `${title}, click to accept all`,
        );
        this.#tooltip.content = {
          title,
          body: this.#panelBody(state.text),
          action: { label: "Accept all", onClick: this.#handleWrongClick },
        };
        this.#button.addEventListener("click", this.#handleWrongClick);
        return;
      }
      case "error":
        this.#show();
        this.#setGlyph(powerIcon, "Grammar check unavailable");
        this.#tooltip.content = {
          title: "Grammar check unavailable",
          body: state.text,
          muted: true,
          action: { label: "Open docs", onClick: this.#handleErrorClick },
        };
        this.#button.addEventListener("click", this.#handleErrorClick);
        return;
    }
  }

  // skipped when unchanged, so the glyph's entrance doesn't replay on every keystroke
  #setGlyph(html: string, label: string) {
    this.#button.ariaLabel = label;
    if (this.#glyph === html) {
      return;
    }
    this.#glyph = html;
    this.#button.innerHTML = `<span class="aig-glyph">${html}</span>`;
  }

  #readText() {
    return this.textArea instanceof HTMLTextAreaElement
      ? this.textArea.value
      : this.textArea.innerText;
  }

  public update() {
    // our own edits fire input events; the result is still valid, no need to re-query
    if (this.#applying) {
      return;
    }

    this.#rewriteCard.hide();
    this.#hideRewriteButton();
    this.#session.edit(this.#readText());
    this.updatePosition();
  }

  get #text() {
    return this.#session.text;
  }

  #render() {
    this.#setLong();
    const state = this.#session.state;
    switch (state.type) {
      case "empty":
      case "loading":
        this.#setState(state);
        return;
      case "error":
        this.#setState({ type: "error", text: this.#errorText(state.error) });
        return;
      case "done":
        if (!state.hunks.length) {
          this.#setState({ type: "correct" });
          return;
        }
        this.#setState({
          type: "wrong",
          text: createDiff(this.#text, state.result, (hunk) => this.#applyHunks([hunk])),
          count: state.hunks.length,
        });
        this.#card.hide();
        this.#underlines.set(this.#text, state.hunks);
    }
  }

  #errorText(error: any) {
    if (!this.#provider) {
      return "AI is not supported. Please enable it in your browser settings.";
    }
    console.warn(error);
    // the extension was reloaded or updated after this tab loaded; this script is orphaned
    if (!chrome.runtime?.id) {
      return "The extension was updated. Reload this page to check your text again.";
    }
    const message = error?.message ?? error?.toString();
    return "Something went wrong. Please try again." + (message ? ` (${message})` : "");
  }

  // Drops suggestions on words just added to the dictionary or on changes just ignored,
  // without a new model call.
  public refresh() {
    this.#session.refresh();
  }

  #applyHunks(hunks: Hunk[]) {
    this.#applying = true;
    try {
      // from the end, so earlier offsets stay valid
      for (const hunk of [...hunks].sort((a, b) => b.start - a.start)) {
        replaceText(this.textArea, hunk);
      }
    } finally {
      this.#applying = false;
    }
    this.#session.edit(this.#readText(), { keep: true });
  }

  public updatePosition() {
    computePosition(this.textArea, this.#button, {
      placement: "bottom-end",
      middleware: [
        offset((state) => ({
          mainAxis:
            -getButtonVerticalPadding(state.rects.reference) - buttonSize,
          crossAxis: -buttonPadding,
        })),
      ],
    }).then(({ x, y }) => {
      Object.assign(this.#button.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });

    this.#isVisible = isVisible(this.#button, this.textArea);
    this.#updateButtonVisibility();
    this.#underlines.draw();
    this.#long.draw();
  }

  #handleErrorClick = () => {
    window
      .open(
        "https://github.com/florianlauer/prosed#troubleshooting",
        "_blank",
      )
      ?.focus();
  };

  #handleWrongClick = () => {
    if (this.#session.hunks.length) {
      this.#applyHunks(this.#session.hunks);
    }
  };

  #updateButtonVisibility() {
    if (this.#isVisible && this.#showButton) {
      this.#button.style.opacity = "1";
      this.#button.style.pointerEvents = "auto";
    } else {
      this.#button.style.opacity = "0";
      this.#button.style.pointerEvents = "none";
    }
  }

  #show() {
    this.#showButton = true;
    this.#updateButtonVisibility();
  }

  #hide() {
    this.#showButton = false;
    this.#updateButtonVisibility();
  }

  get #isCorrect() {
    return this.#session.state.type === "done" && !this.#session.hunks.length;
  }

  destroy() {
    this.#session.stop();
    this.#textObserver?.disconnect();
    this.#button.remove();
    this.#tooltip.destroy();
    this.#underlines.destroy();
    this.#card.destroy();
    this.#long.destroy();
    this.#rewriteCard.destroy();
    this.#rewriteButton.remove();
    clearTimeout(this.#selectionTimer);
    document.removeEventListener("selectionchange", this.#scheduleSelection);
    for (const type of ["select", "mouseup", "keyup"]) {
      this.textArea.removeEventListener(type, this.#scheduleSelection);
    }
    document.removeEventListener("mousedown", this.#handleMouseDown, true);
    document.removeEventListener("keydown", this.#handleKeyDown, true);
    document.removeEventListener("mousemove", this.#handleMouseMove);
    window.removeEventListener("scroll", this.#handleScroll, { capture: true });
    clearTimeout(this.#hideTimer);
    if (this.#updateInterval) {
      clearInterval(this.#updateInterval);
    }
  }

  isSameElement(el: EventTarget | null) {
    return this.textArea === el || this.#button == el;
  }
}

let control: Control | null = null;

const logSkipped = (target: EventTarget, event: string) => {
  if (target instanceof HTMLElement) {
    debug(`${event}: not a checked field`, describe(target), {
      contentEditable: target.contentEditable,
      spellcheck: target.spellcheck,
    });
  }
};

const siteDisabled = () => settings.disabledSites.includes(location.hostname);

const inputListener = (provider: () => Provider | null) => async (e: Event) => {
  const target = e.target;
  if (siteDisabled()) {
    return;
  }

  if (!target || !isTextArea(target)) {
    if (target) logSkipped(target, "input");
    return;
  }

  const unit = checkUnit(target);
  if (!unit) {
    return;
  }

  if (unit === control?.textArea) {
    control.update();
    return;
  }

  control?.destroy();

  debug("input: checking", describe(unit));
  control = new Control(unit, provider());
  control.update();
};

const focusListener = (provider: () => Provider | null) => async (e: Event) => {
  const target = e.target;
  if (siteDisabled()) {
    return;
  }

  if (!target || !isTextArea(target)) {
    if (target) logSkipped(target, "focus");
    return;
  }

  // the caret may not be placed yet on focus; the next input picks the block then
  const unit = checkUnit(target);
  if (!unit || control?.isSameElement(unit)) {
    return;
  }

  control?.destroy();

  debug("focus: checking", describe(unit));
  control = new Control(unit, provider());
  control.update();
};

const targets = new Set<HTMLTextAreaElement | HTMLElement>();

const updateTargets = (provider: () => Provider | null) => {
  for (const target of targets) {
    if (!document.body.contains(target)) {
      targets.delete(target);
    }
  }

  document
    .querySelectorAll("textarea, [contenteditable=true]")
    .forEach((el) => {
      if (targets.has(el as HTMLTextAreaElement | HTMLElement)) {
        return;
      }

      targets.add(el as HTMLTextAreaElement | HTMLElement);
      debug("watching", describe(el));

      el.addEventListener("input", inputListener(provider), true);
      el.addEventListener("focus", focusListener(provider), true);
    });
};

const main = async () => {
  settings = await loadSettings();
  let provider: Provider | null = null;
  let selection = 0;
  const currentProvider = () => provider;
  const resetControl = () => {
    control?.destroy();
    control = null;
  };
  const selectProvider = async () => {
    const request = ++selection;
    resetControl();
    provider = null;
    const model = settings.model;
    const candidates = model === GEMINI_MODEL ? [gemini] : [ollama, gemini];
    let selected: Provider | null = null;
    for (const candidate of candidates) {
      if (await candidate.isSupported()) {
        selected = candidate;
        break;
      }
    }
    if (selection !== request) return;
    provider = selected;
    resetControl();
    debug("provider", provider?.name ?? "none");
    const target = document.activeElement;
    const unit =
      target && isTextArea(target) && !siteDisabled()
        ? checkUnit(target)
        : null;
    if (unit) {
      control = new Control(unit, provider);
      control.update();
    }
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "gemini.ready" && settings.model === GEMINI_MODEL) {
      void selectProvider();
    }
  });
  onSettingsChange((next) => {
    const modelChanged = next.model !== settings.model;
    const filtersChanged =
      JSON.stringify([next.dictionary, next.ignored]) !==
      JSON.stringify([settings.dictionary, settings.ignored]);
    settings = next;
    if (modelChanged) void selectProvider();
    if (siteDisabled()) {
      control?.destroy();
      control = null;
    } else if (filtersChanged && !modelChanged) {
      control?.refresh();
    }
  });

  await selectProvider();

  const observer = new MutationObserver(() => {
    if (control?.textArea && !document.body.contains(control?.textArea)) {
      debug("checked field left the page", describe(control.textArea));
      control?.destroy();
      control = null;
    }

    updateTargets(currentProvider);
  });
  observer.observe(document, { childList: true, subtree: true });

  updateTargets(currentProvider);
};

main();
