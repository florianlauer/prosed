// The popover next to the text, built like the extension's: the card of a fix, the badge's
// panel, the offer on a long sentence, and rewrites (from the shortcut, a tone of the panel or
// a long sentence). The window doesn't take the keyboard, so the app keeps its caret.
import "./chrome.ts";
import "../../src/contentScript/overlay.css";
import "./card.css";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { Tone } from "../../src/prompts.ts";
import { getLocale, setLocale, toneMessages, formalityMessages, t, type MessageKey, type Values } from "../../src/i18n/index.ts";
import { localize, localizeNote, message, translateOverlay } from "../../src/i18n/dom.ts";
import { createDiff, rewriteIcon } from "../../src/contentScript/render.ts";
import { diffHunks, dictionaryCandidate, wordCount } from "../../src/contentScript/text.ts";
import { loadSettings, onSettingsChange } from "../../src/settings.ts";
import { check, fitSelection, formality, rewrite, tonesFor } from "../../src/check.ts";
import { followTheme, generate, getConfig, saveConfig, type App, type Rect } from "./api.ts";

type Span = { text: string; start: number; end: number };
type Panel = {
  kind: "panel";
  // the id of the field the text is from, for a rewrite to go back there
  field: number;
  state: "loading" | "wrong" | "correct" | "error";
  error: string;
  text: string;
  result: string | null;
  long: (Span & { anchor: Rect })[];
  whole: (Span & { anchor: Rect }) | null;
  app: App | null;
};
type Payload =
  | { kind: "fix"; text: string; field: number; index: number; removed: string; added: string }
  | { kind: "offer"; field: number; sentence: Span }
  | Panel
  | { kind: "rewrite"; text: string | null; tone?: Tone; fix?: boolean; field?: Field | null };
type Field = { text: string; start: number };

followTheme();
let uiSettings = await loadSettings();
setLocale(uiSettings.uiLocale);
document.documentElement.lang = getLocale();
const translate = () => {
  setLocale(uiSettings.uiLocale);
  document.documentElement.lang = getLocale();
  translateOverlay();
  const pop = document.querySelector<HTMLElement>(".aig-pop");
  if (pop) void place(pop);
};
onSettingsChange((settings) => { uiSettings = settings; translate(); });
window.addEventListener("languagechange", translate);
// answers for a popover that has been replaced are dropped
let session = 0;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const button = (className: string, onclick: () => void, children: (Node | string)[]) =>
  el("button", { type: "button", className, onclick }, children);

const label = (key: MessageKey, busy = false, values: Values = {}) => {
  const node = localize(el("div", { className: "aig-card__label" }), key, values);
  node.toggleAttribute("data-busy", busy);
  return node;
};

const rawNote = (text: string) => localizeNote(el("p", { className: "aig-card__note" }), text);
const note = (key: MessageKey) => localize(el("p", { className: "aig-card__note" }), key);

// The window is sized to the popover after every change, and the popover gets the side it opened on.
// numbered, so Rust drops a size that arrives after a newer one; from the clock, so the numbers
// keep growing when the page reloads
let placeSeq = Date.now();
const place = async (pop: HTMLElement) => {
  const side = await invoke<string | null>("place_card", { width: pop.offsetWidth, height: pop.offsetHeight, seq: ++placeSeq });
  if (side) {
    pop.dataset.side = `${side}-start`;
  }
};

// A new popover replaces the one shown, with the extension's open transition.
const show = (className: string, children: Node[]) => {
  const pop = el("div", { className: `aig-root aig-pop ${className}`, role: "dialog" }, children);
  pop.lang = getLocale();
  document.body.replaceChildren(pop);
  // measured right away: WebKit runs no animation frames in a hidden window
  void pop.offsetWidth;
  pop.dataset.open = "";
  place(pop);
  return pop;
};

const close = () => {
  session++;
  invoke("hide_card");
};

// `from` is the text and field the card was built on: the overlay drops the action if they changed since.
type From = { text: string; field: number };
const act = (from: From, index: number, action: "accept" | "ignore" | "word" | "accept-all", word?: string) => {
  emitTo("overlay", "fix-action", { ...from, index, action, word });
  close();
};

// The card stays until it's used or closed: the overlay lets go of it.
const rewriteSpan = ({ text, start, end }: Span, tone: Tone, anchor: Rect | null, field: number) => {
  invoke("open_rewrite_text", { selection: { text, start, end }, tone, anchor, field });
};

// whitespace-only changes would otherwise render as an empty label
const quoted = (s: string) => `“${s.trim() || t("space")}”`;

const showFix = ({ text, field, index, removed, added }: Extract<Payload, { kind: "fix" }>) => {
  const from = { text, field };
  const word = dictionaryCandidate(removed);
  show("aig-card", [
    ...(removed && added ? [el("div", { className: "aig-card__was" }, [removed])] : []),
    button("aig-card__apply", () => act(from, index, "accept"), [
      removed && added ? added : removed ? message("removeText", { text: quoted(removed) }) : message("addText", { text: quoted(added) }),
    ]),
    ...(word ? [button("aig-card__secondary", () => act(from, index, "word", word), [message("addWord", { word: quoted(word) })])] : []),
    button("aig-card__secondary", () => act(from, index, "ignore"), [message("ignore")]),
  ]);
};

const showOffer = ({ sentence, field }: Extract<Payload, { kind: "offer" }>) => {
  const offer = button("aig-card__rewrite", () => rewriteSpan(sentence, "clearer", null, field), []);
  offer.innerHTML = rewriteIcon;
  offer.append(message("rewriteSentence"));
  show("aig-card aig-card--rewrite", [label("longSentence", false, { count: wordCount(sentence.text) }), offer]);
};

const section = (key: MessageKey, kind: "fix" | "rewrite") => {
  const node = localize(el("div", { className: "aig-section" }), key);
  node.dataset.kind = kind;
  return node;
};

const turnOff = (app: App) => invoke("set_app", { target: app, listed: true, enabled: false });

const showPanel = ({ field, state, error, text, result, long, whole, app }: Panel) => {
  const hunks = result === null ? [] : diffHunks(text, result);
  const title = {
    loading: message("checkingProgress"),
    error: message("checkUnavailable"),
    correct: message("noFixes"),
    wrong: message("suggestions", { count: hunks.length }),
  }[state];
  const body = el("div", { className: "aig-panel__body" });
  if (state === "error") {
    body.append(message("somethingWrong"), error ? ` ${error}` : "");
  } else if (state !== "loading") {
    if (state === "wrong" && result !== null) {
      const diff = createDiff(text, result, (hunk) =>
        act({ text, field }, hunks.findIndex((h) => h.start === hunk.start && h.end === hunk.end), "accept"),
      );
      body.append(section("fixes", "fix"), el("div", {}, [diff]));
    }
    if (long.length) {
      body.append(section("rewrites", "rewrite"));
    }
    for (const sentence of long) {
      const item = button("aig-rewrite-item", () => rewriteSpan(sentence, "clearer", sentence.anchor, field), [
        message("sentencePreview", { text: sentence.text.split(/\s+/).slice(0, 6).join(" "), count: wordCount(sentence.text) }),
      ]);
      localize(item, "rewriteSentence", {}, "title");
      body.append(item);
    }
    if (whole) {
      const chips = tonesFor(whole.text).map((tone) =>
        button("aig-chip", () => rewriteSpan(whole, tone, whole.anchor, field), [message(toneMessages[tone])]),
      );
      body.append(section("wholeText", "rewrite"), localize(el("div", { className: "aig-chips", role: "group" }, chips), "wholeTextTone", {}, "aria-label"));
    }
  }
  const pop = show("aig-panel", [
    el("div", { className: "aig-panel__head" }, [
      el("span", { className: "aig-panel__title" }, [title]),
      ...(state === "wrong" ? [button("aig-action", () => act({ text, field }, -1, "accept-all"), [message("acceptAll")])] : []),
    ]),
    body,
    el("div", { className: "aig-panel__foot" }, [
      button(
        "aig-link",
        () => {
          close();
          invoke("show_settings");
        },
        [message("settings")],
      ),
      ...(app
        ? [
            button(
              "aig-link",
              () => {
                close();
                turnOff(app);
              },
              [message("turnOffApp", { app: app.name })],
            ),
          ]
        : []),
    ]),
  ]);
  pop.toggleAttribute("data-muted", state === "error");
};

const showRewrite = async ({ text, tone: first = "clearer", fix = false, field }: Extract<Payload, { kind: "rewrite" }>) => {
  const current = ++session;
  if (!text) {
    show("aig-card", [note("selectTextFirst")]);
    return;
  }
  const settings = await loadSettings();
  if (current !== session) {
    return;
  }
  let tone = first;
  // level 1 also offers the fixed text, the one thing the extension's rewrite card doesn't have
  const fixed = el("div", { className: "aig-card__body" }, [label("checkingProgress", true)]);
  const meter = el("div", { className: "aig-meter", hidden: true });
  const body = el("div", { className: "aig-card__body" });
  const chips = tonesFor(text).map((t) => {
    const chip = button("aig-chip", () => pick(t), [message(toneMessages[t])]);
    chip.dataset.tone = t;
    return chip;
  });
  const pop = show("aig-card aig-card--rewrite", [
    ...(fix ? [fixed] : []),
    meter,
    localize(el("div", { className: "aig-chips", role: "group" }, chips), "tone", {}, "aria-label"),
    body,
    button("aig-card__secondary", close, [message("close")]),
  ]);
  // the new versions leave out the spaces the selection may have around it
  const use = (version: string) =>
    invoke("replace_selection", { text: text.match(/^\s*/)![0] + version + text.match(/\s*$/)![0] });
  const update = (target: HTMLElement, children: (Node | string)[]) => {
    if (current === session) {
      target.replaceChildren(...children);
      place(pop);
    }
  };

  const pick = async (t: Tone) => {
    tone = t;
    for (const chip of chips) {
      chip.ariaPressed = String(chip.dataset.tone === t);
    }
    update(body, [label("rewriting", true)]);
    try {
      const { variants, notes } = await rewrite({ text, tone: t, settings, field, generate });
      if (t !== tone) {
        return;
      }
      // false friends are worth reading even when no variant made it
      const noteList = notes.length ? [label("wordsToCheck"), ...notes.map(rawNote)] : [];
      update(
        body,
        variants.length
          ? [
              label(t === "clearer" ? "rewrites" : toneMessages[t]),
              ...variants.map((v) => button("aig-card__variant", () => use(v), [v])),
              ...noteList,
            ]
          : [note("noRewrites"), ...noteList],
      );
    } catch (e) {
      if (t === tone) {
        console.warn(e);
        update(body, [note("rewriteFailed")]);
      }
    }
  };

  if (fix) {
    // the fix first: Ollama answers one request at a time on small machines
    // checked alone, the selection gets a capital or a full stop it doesn't have in its sentence
    const checked = await check({ text, settings, channel: "fix", generate }).catch(() => null);
    const result = checked && fitSelection({ text, field })(checked);
    if (result && result !== text.trim()) {
      update(fixed, [label("fixed"), button("aig-card__apply", () => use(result), [result])]);
    } else if (current === session) {
      fixed.remove();
      place(pop);
    }
  }
  if (current !== session) {
    return;
  }
  const rewriting = pick(first);
  // sent after the rewrite, so an Ollama that runs one request at a time answers the rewrite first
  formality({ text, settings, generate }).then(
    (level) => {
      const dots = el(
        "span",
        { className: "aig-meter__dots", ariaHidden: "true" },
        [1, 2, 3, 4, 5].map((i) => {
          const dot = el("span");
          dot.toggleAttribute("data-on", i <= level);
          return dot;
        }),
      );
      localize(meter, "formalityMeter", { level }, "title");
      meter.hidden = false;
      update(meter, [message("sounds"), dots, localize(el("strong"), formalityMessages[level - 1])]);
    },
    (e) => console.warn(e),
  );
  await rewriting;
};

listen<Payload>("card", ({ payload }) => {
  if (payload.kind === "rewrite") {
    showRewrite(payload);
    return;
  }
  session++;
  if (payload.kind === "fix") {
    showFix(payload);
  } else if (payload.kind === "offer") {
    showOffer(payload);
  } else {
    showPanel(payload);
  }
});
