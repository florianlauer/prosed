import {
  getLocale,
  noteTranslation,
  t,
  type MessageKey,
  type Values,
} from "./index.ts";

const attributes = {
  "data-i18n": "textContent",
  "data-i18n-title": "title",
  "data-i18n-placeholder": "placeholder",
  "data-i18n-aria-label": "aria-label",
  "data-i18n-empty": "data-empty",
} as const;
type Target = (typeof attributes)[keyof typeof attributes];

export const localize = <T extends HTMLElement>(
  node: T,
  key: MessageKey,
  values: Values = {},
  target: Target = "textContent",
): T => {
  values = { ...JSON.parse(node.dataset.i18nValues ?? "{}"), ...values };
  const marker = Object.entries(attributes).find(
    ([, attribute]) => attribute === target,
  )![0];
  node.setAttribute(marker, key);
  node.dataset.i18nValues = JSON.stringify(values);
  const value = t(key, values);
  if (target === "textContent") node.textContent = value;
  else node.setAttribute(target, value);
  return node;
};

export const message = (key: MessageKey, values: Values = {}) =>
  localize(document.createElement("span"), key, values);

export const localizeNote = <T extends HTMLElement>(
  node: T,
  note: string,
): T => {
  const translation = noteTranslation(note);
  if (translation) return localize(node, translation.key, translation.values);
  node.textContent = note;
  return node;
};

export const translateElements = (root: ParentNode) => {
  const selector = Object.keys(attributes)
    .map((attribute) => `[${attribute}]`)
    .join(",");
  const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector))
    nodes.unshift(root);
  for (const node of nodes) {
    const values: Values = JSON.parse(node.dataset.i18nValues ?? "{}");
    for (const [marker, target] of Object.entries(attributes)) {
      const key = node.getAttribute(marker) as MessageKey | null;
      if (key) localize(node, key, values, target);
    }
  }
};

// Restrict translation to our UI; the host page's text and language belong to its author.
export const translateOverlay = () => {
  for (const root of document.querySelectorAll<HTMLElement>(".aig-root")) {
    root.lang = getLocale();
    translateElements(root);
  }
};
