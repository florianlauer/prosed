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
import { GEMINI_MODEL, GEMINI_TEST_BACKEND_ERROR, geminiAvailability, geminiOptions, geminiVerify } from "../gemini";
import { initCloudSettings } from "./cloud";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

document.querySelector("main")!.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
$("version").textContent = `Version ${chrome.runtime.getManifest().version}`;

// Accepts a pasted URL as well as a bare hostname.
const hostnameOf = (value: string) => {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
};

const renderList = <T,>({
  list,
  items,
  onRemove,
  text = String,
  action = "Remove",
}: {
  list: HTMLUListElement;
  items: T[];
  onRemove: (item: T) => void;
  text?: (item: T) => string;
  action?: string;
}) => {
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = text(item);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aig-link";
      remove.textContent = action;
      remove.ariaLabel = `${action} ${text(item)}`;
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
      input.setCustomValidity("That doesn't look like a site.");
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

const geminiLabels: Record<Availability, string> = {
  available: "",
  downloadable: " (download required)",
  downloading: " (downloading)",
  unavailable: " (unavailable)",
};

const modelStatus = () => {
  if (settings.model === GEMINI_MODEL) {
    if (gemini === "available") return "Gemini Nano runs locally in Chrome. Your text stays on this device.";
    if (gemini === "unavailable") return "Gemini Nano isn't available in this browser. Choose an installed Ollama model.";
    return "Select Gemini Nano to finish downloading the model in Chrome.";
  }
  if (models === null) {
    const offline = $("model-status").dataset.offline;
    if (offline !== undefined) return offline;
    if (gemini === "available") return "Ollama isn't reachable. Checks use Gemini Nano in Chrome. You can select it here.";
    if (gemini !== "unavailable") return "Ollama isn't reachable. Select Gemini Nano to download Chrome's local model.";
    return "No model is available. Start Ollama, or use Chrome on a device that supports Gemini Nano.";
  }
  if (models.length === 0) return "Ollama is running but has no models. Pull one with “ollama pull gemma4:e2b-it-qat”.";
  return "The Ollama model used for every check. Larger models are slower but catch more.";
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
        option.textContent = `Gemini Nano · Chrome${geminiLabels[gemini]}`;
        option.disabled = gemini === "unavailable";
      } else if (models && !models.includes(name)) {
        option.textContent = `${name} (not installed)`;
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
    download.textContent =
      gemini === "downloading"
        ? "Finish downloading Gemini Nano"
        : "Download Gemini Nano";
  }
  $("model-status").textContent = modelStatus();
};

const render = () => {
  renderModel();
  renderList({
    list: $("dictionary"),
    items: settings.dictionary,
    onRemove: (word) => saveSettings({ dictionary: settings.dictionary.filter((w) => w !== word) }),
  });
  renderList({
    list: $("ignored"),
    items: settings.ignored,
    text: ({ from, to }) => `${from || "(nothing)"} → ${to || "(nothing)"}`,
    action: "Restore",
    onRemove: (change) => saveSettings({ ignored: settings.ignored.filter((c) => !sameChange(c, change)) }),
  });
  for (const select of styleSelects) {
    select.value = settings.style[select.name as keyof Style];
  }
  // the desktop app has no sites, it lists apps instead
  if ($("sites")) {
    renderList({
      list: $("sites"),
      items: settings.disabledSites,
      onRemove: (site) => saveSettings({ disabledSites: settings.disabledSites.filter((s) => s !== site) }),
    });
  }
};

const styleSelects = document.querySelectorAll<HTMLSelectElement>("#style select");
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
  load.textContent = `Loading ${modelName}…`;
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
            load.textContent = `Downloading Gemini Nano… ${Math.round(event.loaded * 100)}%`;
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
      await send({ type: "ollama.switch", data: { from, to: null } }).catch(console.warn);
    }
    if (to === GEMINI_MODEL && from === to) {
      await send({ type: "gemini.ready" });
    }
    load.dataset.state = "ready";
    load.textContent = `${modelName} is loaded. Checks use it from now on.`;
  } catch (error) {
    if (error instanceof Error && error.message === GEMINI_TEST_BACKEND_ERROR) {
      gemini = "unavailable";
    }
    load.dataset.state = "error";
    load.textContent = `Couldn't load ${modelName}: ${error instanceof Error ? error.message : String(error)}`;
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
  await initCloudSettings();

  const [list, availability] = await Promise.all([
    send({ type: "ollama.list" }).catch(() => null),
    geminiAvailability(),
  ]);
  models = list ? list.models.map((m) => m.name).sort() : null;
  gemini = availability;
  renderModel();
};

init();
