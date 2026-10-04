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
import { getLocale, isUiLocale, setLocale, t } from "../i18n/index.ts";
import { localize, translateElements } from "../i18n/dom.ts";

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

const renderModel = () => {
  const select = $<HTMLSelectElement>("model");
  const names = models ?? [];
  const options = names.includes(settings.model)
    ? names
    : [settings.model, ...names];
  select.replaceChildren(
    ...options.map((name) => {
      const option = new Option(name, name, false, name === settings.model);
      if (models && !models.includes(name)) {
        localize(option, "modelNotInstalled", { model: name });
      }
      return option;
    }),
  );
  select.disabled = switching || !models?.length;
  localize(
    $("model-status"),
    models === null
      ? $("model-status").dataset.platform === "desktop"
        ? "modelOfflineDesktop"
        : "modelOfflineExtension"
      : models.length === 0
        ? "modelEmpty"
        : "modelHint",
  );
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

$<HTMLSelectElement>("model").addEventListener("change", async (e) => {
  const select = e.target as HTMLSelectElement;
  const from = settings.model;
  const to = select.value;
  const load = $("model-load");
  load.hidden = false;
  load.dataset.state = "loading";
  localize(load, "modelLoading", { model: to });
  switching = true;
  select.disabled = true;
  await saveSettings({ model: to });

  const response = await send({
    type: "ollama.switch",
    data: { from: models?.includes(from) ? from : null, to },
  });
  switching = false;
  select.disabled = false;
  if (response && "ok" in response) {
    load.dataset.state = "ready";
    localize(load, "modelLoaded", { model: to });
  } else {
    load.dataset.state = "error";
    const detail = response
      ? document.createTextNode(` ${response.error}`)
      : "";
    load.replaceChildren(
      localize(document.createElement("span"), "modelFailed", { model: to }),
      detail,
    );
    load.removeAttribute("data-i18n");
  }
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

  const list = await send({ type: "ollama.list" });
  models = list ? list.models.map((m) => m.name).sort() : null;
  renderModel();
};

init();
