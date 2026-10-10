import "../contentScript/overlay.css";
import "./options.css";
import {
  addToDictionary,
  disableSite,
  loadSettings,
  onSettingsChange,
  sameChange,
  saveSettings,
  Settings,
  Style,
} from "../settings";
import { send } from "../messages";
import { initCloudSettings } from "./cloud";
import {
  getLocale,
  isUiLocale,
  setLocale,
  t,
  type MessageKey,
} from "../i18n/index.ts";
import { localize, translateElements, unlocalize } from "../i18n/dom.ts";
import {
  GEMINI_MODEL,
  GEMINI_TEST_BACKEND_ERROR,
  geminiAvailability,
  geminiOptions,
  geminiVerify,
} from "../gemini";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

document.querySelector("main")!.dataset.theme = matchMedia(
  "(prefers-color-scheme: dark)",
).matches
  ? "dark"
  : "light";

// Accepts a pasted URL as well as a bare hostname.
const hostnameOf = (value: string) => {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
};

const renderList = <T>({
  list,
  items,
  onRemove,
  text = String,
  action = "remove",
}: {
  list: HTMLUListElement;
  items: T[];
  onRemove: (item: T) => void;
  text?: (item: T) => string;
  action?: "remove" | "restore";
}) => {
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = text(item);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aig-link";
      localize(remove, action, { item: text(item) });
      localize(
        remove,
        action === "remove" ? "removeItem" : "restoreItem",
        { item: text(item) },
        "aria-label",
      );
      remove.addEventListener("click", () => onRemove(item));
      li.append(label, remove);
      return li;
    }),
  );
};

const bindAdd = ({
  form,
  parse,
  onAdd,
}: {
  form: HTMLFormElement;
  parse: (value: string) => string | null;
  onAdd: (item: string) => void;
}) => {
  const input = form.elements.namedItem("value") as HTMLInputElement;
  input.addEventListener("input", () => input.setCustomValidity(""));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = parse(input.value.trim());
    if (!item) {
      input.setCustomValidity(t("invalidSite"));
      input.reportValidity();
      return;
    }
    onAdd(item);
    input.value = "";
  });
};

let settings: Settings;
let models: string[] | null = null;
let switching = false;
let gemini: Availability = "unavailable";

const geminiLabels: Record<Availability, MessageKey> = {
  available: "geminiAvailableOption",
  downloadable: "geminiDownloadRequiredOption",
  downloading: "geminiDownloadingOption",
  unavailable: "geminiUnavailableOption",
};

const modelStatus = (): MessageKey => {
  if (settings.model === GEMINI_MODEL) {
    if (gemini === "available") return "geminiLocalHint";
    if (gemini === "unavailable") return "geminiUnavailableHint";
    return "geminiDownloadHint";
  }
  if (models === null) {
    if ($("model-status").dataset.platform === "desktop")
      return "modelOfflineDesktop";
    if (gemini === "available") return "ollamaOfflineGeminiReady";
    if (gemini !== "unavailable") return "ollamaOfflineGeminiDownload";
    return "noModelAvailable";
  }
  if (models.length === 0) return "modelEmpty";
  return "modelHint";
};

const renderModel = () => {
  const select = $<HTMLSelectElement>("model");
  const names = [
    ...(models ?? []),
    ...(gemini !== "unavailable" ? [GEMINI_MODEL] : []),
  ];
  const options = names.includes(settings.model)
    ? names
    : [settings.model, ...names];
  select.replaceChildren(
    ...options.map((name) => {
      const option = new Option(name, name, false, name === settings.model);
      if (name === GEMINI_MODEL) {
        localize(option, geminiLabels[gemini]);
        option.disabled = gemini === "unavailable";
      } else if (models && !models.includes(name)) {
        localize(option, "modelNotInstalled", { model: name });
        option.disabled = true;
      }
      return option;
    }),
  );
  select.disabled = switching || names.length === 0;
  const download = $<HTMLButtonElement>("gemini-download");
  if (download) {
    download.hidden = gemini !== "downloadable" && gemini !== "downloading";
    download.disabled = switching;
    localize(
      download,
      gemini === "downloading" ? "finishGeminiDownload" : "downloadGemini",
    );
  }
  localize($("model-status"), modelStatus());
};

const render = () => {
  setLocale(settings.uiLocale);
  document.documentElement.lang = getLocale();
  translateElements(document);
  localize($("version"), "version", {
    version: chrome.runtime.getManifest().version,
  });
  $<HTMLSelectElement>("ui-locale").value = settings.uiLocale;
  const siteInput =
    document.querySelector<HTMLInputElement>("#sites-form input");
  if (siteInput?.validity.customError)
    siteInput.setCustomValidity(t("invalidSite"));
  renderModel();
  renderList({
    list: $("dictionary"),
    items: settings.dictionary,
    onRemove: (word) =>
      saveSettings({
        dictionary: settings.dictionary.filter((w) => w !== word),
      }),
  });
  renderList({
    list: $("ignored"),
    items: settings.ignored,
    text: ({ from, to }) => `${from || t("nothing")} → ${to || t("nothing")}`,
    action: "restore",
    onRemove: (change) =>
      saveSettings({
        ignored: settings.ignored.filter((c) => !sameChange(c, change)),
      }),
  });
  for (const select of styleSelects) {
    select.value = settings.style[select.name as keyof Style];
  }
  // the desktop app has no sites, it lists apps instead
  if ($("sites")) {
    renderList({
      list: $("sites"),
      items: settings.disabledSites,
      onRemove: (site) =>
        saveSettings({
          disabledSites: settings.disabledSites.filter((s) => s !== site),
        }),
    });
  }
};

const styleSelects =
  document.querySelectorAll<HTMLSelectElement>("#style select");
$<HTMLSelectElement>("ui-locale").addEventListener("change", (e) => {
  const uiLocale = (e.target as HTMLSelectElement).value;
  if (isUiLocale(uiLocale)) void saveSettings({ uiLocale });
});
window.addEventListener("languagechange", () => {
  if (settings) render();
});
for (const select of styleSelects) {
  select.addEventListener("change", () =>
    saveSettings({ style: { ...settings.style, [select.name]: select.value } }),
  );
}

const switchModel = async (to: string) => {
  if (switching) return;
  const select = $<HTMLSelectElement>("model");
  const from = settings.model;
  const modelName = to === GEMINI_MODEL ? "Gemini Nano" : to;
  const load = $("model-load");
  load.hidden = false;
  load.dataset.state = "loading";
  localize(load, "modelLoading", { model: modelName });
  switching = true;
  select.disabled = true;
  const download = $<HTMLButtonElement>("gemini-download");
  if (download) download.disabled = true;
  try {
    if (to === GEMINI_MODEL) {
      // Start before awaiting storage: Chrome may require the selector's user activation to download.
      const session = await LanguageModel.create({
        ...geminiOptions,
        monitor: (monitor) =>
          monitor.addEventListener("downloadprogress", (event) => {
            localize(load, "geminiDownloadProgress", {
              percent: Math.round(event.loaded * 100),
            });
          }),
      });
      try {
        await geminiVerify({ session });
      } finally {
        session.destroy();
      }
      gemini = "available";
    } else {
      const response = await send({
        type: "ollama.switch",
        data: { from: models?.includes(from) ? from : null, to },
      });
      if (!response || !("ok" in response)) {
        throw new Error(response ? response.error : "Ollama isn't reachable.");
      }
    }
    await saveSettings({ model: to });
    settings = { ...settings, model: to };
    if (to === GEMINI_MODEL && from !== GEMINI_MODEL) {
      await send({ type: "ollama.switch", data: { from, to: null } }).catch(
        console.warn,
      );
    }
    if (to === GEMINI_MODEL && from === to) {
      await send({ type: "gemini.ready" });
    }
    load.dataset.state = "ready";
    localize(load, "modelLoaded", { model: modelName });
  } catch (error) {
    if (error instanceof Error && error.message === GEMINI_TEST_BACKEND_ERROR) {
      gemini = "unavailable";
    }
    load.dataset.state = "error";
    unlocalize(load);
    load.replaceChildren(
      localize(document.createElement("span"), "modelFailed", {
        model: modelName,
      }),
      ` ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    switching = false;
    renderModel();
  }
};
$<HTMLSelectElement>("model").addEventListener("change", (e) => {
  void switchModel((e.target as HTMLSelectElement).value);
});
$("gemini-download")?.addEventListener("click", () => {
  void switchModel(GEMINI_MODEL);
});
bindAdd({
  form: $("dictionary-form"),
  parse: (value) => value || null,
  onAdd: addToDictionary,
});
if ($("sites-form")) {
  bindAdd({
    form: $("sites-form"),
    parse: hostnameOf,
    onAdd: disableSite,
  });
}

// also picks up words added from a suggestion card while this page is open
onSettingsChange((next) => {
  settings = next;
  render();
});

const init = async () => {
  settings = await loadSettings();
  render();
  await Promise.all([
    initCloudSettings(),
    Promise.all([
      send({ type: "ollama.list" }).catch(() => null),
      geminiAvailability(),
    ]).then(([list, availability]) => {
      models = list ? list.models.map((m) => m.name).sort() : null;
      gemini = availability;
      renderModel();
    }),
  ]);
};

init();
