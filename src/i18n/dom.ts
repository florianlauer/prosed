import {
  getLocale,
  noteTranslation,
  t,
  type MessageKey,
  type Values,
} from "./index.ts";

const attributes = {
  textContent: "data-i18n",
  title: "data-i18n-title",
  placeholder: "data-i18n-placeholder",
  "aria-label": "data-i18n-aria-label",
  "data-empty": "data-i18n-empty",
} as const;
type Target = keyof typeof attributes;

export const localize = <T extends HTMLElement>(
  node: T,
  key: MessageKey,
  values: Values = {},
  target: Target = "textContent",
): T => {
  values = { ...JSON.parse(node.dataset.i18nValues ?? "{}"), ...values };
  const marker = attributes[target];
  node.setAttribute(marker, key);
  node.dataset.i18nValues = JSON.stringify(values);
  const value = t(key, values);
  if (target === "textContent") node.textContent = value;
  else node.setAttribute(target, value);
  return node;
};

export const message = (key: MessageKey, values: Values = {}) =>
  localize(document.createElement("span"), key, values);

export const unlocalize = (
  node: HTMLElement,
  target: Target = "textContent",
) => {
  node.removeAttribute(attributes[target]);
  if (!Object.values(attributes).some((marker) => node.hasAttribute(marker)))
    delete node.dataset.i18nValues;
};

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
  const selector = Object.values(attributes)
    .map((attribute) => `[${attribute}]`)
    .join(",");
  const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector))
    nodes.unshift(root);
  for (const node of nodes) {
    const values: Values = JSON.parse(node.dataset.i18nValues ?? "{}");
    for (const [target, marker] of Object.entries(attributes)) {
      const key = node.getAttribute(marker) as MessageKey | null;
      if (key) localize(node, key, values, target as Target);
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
