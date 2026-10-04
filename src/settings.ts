// User settings, in chrome.storage.sync so they follow the browser account without a server.
// ponytail: sync storage caps an item at 8 KB, a few hundred dictionary words or ignored
// changes; move those lists to storage.local if people outgrow that.
import { isUiLocale, type UiLocale } from "./i18n/index.ts";

// A change as whole words, e.g. "review" → "révision".
export type Change = { from: string; to: string };

// Preferences the model can't guess from one message. "any" leaves the choice to the text.
export type Style = {
  address: "any" | "tu" | "vous";
  english: "any" | "us" | "uk";
  // whether informal words like "du coup" count as mistakes
  informal: "keep" | "fix";
};

export type Settings = {
  uiLocale: UiLocale;
  // Picked with bench/grammar-bench.mjs: best accuracy on French typos under 5 GB.
  model: string;
  // Words the extension never changes, matched as whole words with their exact case.
  dictionary: string[];
  // Hostnames where the extension stays off.
  disabledSites: string[];
  // Changes the user refused; never suggested again, on any site.
  ignored: Change[];
  style: Style;
};

export const defaultSettings: Settings = {
  uiLocale: "system",
  model: "gemma4:e2b-it-qat",
  dictionary: [],
  disabledSites: [],
  ignored: [],
  style: { address: "any", english: "any", informal: "keep" },
};

export const loadSettings = async (): Promise<Settings> => {
  const stored = (await chrome.storage.sync.get(defaultSettings)) as Partial<Settings>;
  // merged so a style option added later gets its default
  return {
    ...defaultSettings,
    ...stored,
    uiLocale: isUiLocale(stored.uiLocale) ? stored.uiLocale : "system",
    style: { ...defaultSettings.style, ...stored.style },
  };
};

export const saveSettings = (changes: Partial<Settings>) =>
  chrome.storage.sync.set(changes);

export const onSettingsChange = (listener: (settings: Settings) => void) => {
  const handle = (_: unknown, area: string) => {
    if (area === "sync") {
      loadSettings().then(listener);
    }
  };
  chrome.storage.onChanged.addListener(handle);
  return () => chrome.storage.onChanged.removeListener(handle);
};

export const addToDictionary = async (word: string) => {
  const { dictionary } = await loadSettings();
  if (!dictionary.includes(word)) {
    await saveSettings({ dictionary: [...dictionary, word].sort((a, b) => a.localeCompare(b)) });
  }
};

export const disableSite = async (hostname: string) => {
  const { disabledSites } = await loadSettings();
  if (!disabledSites.includes(hostname)) {
    await saveSettings({ disabledSites: [...disabledSites, hostname].sort() });
  }
};

export const sameChange = (a: Change, b: Change) => a.from === b.from && a.to === b.to;

export const ignoreChange = async (change: Change) => {
  const { ignored } = await loadSettings();
  if (!ignored.some((c) => sameChange(c, change))) {
    await saveSettings({ ignored: [...ignored, change] });
  }
};
