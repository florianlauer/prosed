// The settings window: the extension's options page, then the sections only the app has.
import "./chrome.ts";
import "../../src/options/index.ts";
import "./settings.css";
import { invoke } from "@tauri-apps/api/core";
import { getConfig, onConfig, saveConfig, type App, type Config } from "./api.ts";
import { getLocale, setLocale, t } from "../../src/i18n/index.ts";
import { localize, translateElements } from "../../src/i18n/dom.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let config: Config = await getConfig();
let running: App[] = [];

// Sent one at a time, so an older value can't land last. The "config" events of the saves in
// between are skipped; after the last one the settings show what is on disk, also when a save
// failed.
let saving: Promise<unknown> = Promise.resolve();
let pending = 0;
const queue = (send: () => Promise<unknown>) => {
  pending++;
  saving = saving
    .then(send)
    .catch((e) => console.error(e))
    .then(async () => {
      if (--pending === 0) {
        const saved = await getConfig();
        // a click while it was read is newer
        if (pending === 0) {
          config = saved;
          render();
        }
      }
    });
};

// applied here at once, so a second click before the "config" event builds on the first
const save = (changes: Partial<Config>) => {
  config = { ...config, ...changes };
  queue(() => saveConfig(changes));
};

// the app lists change in Rust, one app at a time, so the card's "Turn off" can't be undone here
const setApp = (target: App, listed: boolean, enabled: boolean) =>
  queue(() => invoke("set_app", { target, listed, enabled }));

const renderApps = () => {
  const apps = [...config.seenApps].sort((a, b) => a.name.localeCompare(b.name));
  $("apps").replaceChildren(
    ...apps.map((app) => {
      const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: !config.disabledApps.includes(app.id) });
      box.addEventListener("change", () => setApp(app, true, box.checked));
      const label = Object.assign(document.createElement("label"), { className: "opt__check" });
      label.append(box, app.name || app.id);
      const id = Object.assign(document.createElement("span"), { className: "opt__meta", textContent: app.id });
      // forgotten until it's typed in again, then back on like any new app
      const remove = Object.assign(document.createElement("button"), {
        type: "button",
        className: "aig-link",
      });
      localize(remove, "remove", { item: app.name || app.id });
      localize(remove, "removeItem", { item: app.name || app.id }, "aria-label");
      remove.addEventListener("click", () => setApp(app, false, true));
      const item = document.createElement("li");
      item.append(label, id, remove);
      return item;
    }),
  );
  // the open apps that aren't listed yet
  const listed = new Set(config.seenApps.map((app) => app.id));
  const options = running.filter((app) => !listed.has(app.id)).sort((a, b) => a.name.localeCompare(b.name));
  $("running").replaceChildren(...options.map((app) => new Option(app.name, app.id)));
  $<HTMLButtonElement>("add-app").disabled = options.length === 0;
};

const render = () => {
  setLocale(config.core?.uiLocale);
  document.documentElement.lang = getLocale();
  translateElements(document);
  void invoke("set_ui_labels", { settings: `${t("settings")}…`, quit: t("quit") }).catch(console.error);
  $<HTMLInputElement>("check").checked = config.checkAsYouType;
  $<HTMLInputElement>("shortcut-enabled").checked = config.shortcutEnabled;
  $<HTMLInputElement>("shortcut").value = config.shortcut;
  $<HTMLInputElement>("shortcut").disabled = !config.shortcutEnabled;
  renderApps();
};

const loadRunning = async () => {
  running = await invoke<App[]>("running_apps");
  renderApps();
};

const checkPermission = async () => {
  $("permission").hidden = await invoke<boolean>("permission", { prompt: false });
};

$("check").addEventListener("change", (e) => save({ checkAsYouType: (e.target as HTMLInputElement).checked }));
$("shortcut-enabled").addEventListener("change", (e) => save({ shortcutEnabled: (e.target as HTMLInputElement).checked }));
// accelerator syntax, e.g. CmdOrCtrl+Alt+G
$("shortcut").addEventListener("change", (e) => save({ shortcut: (e.target as HTMLInputElement).value.trim() }));
$("apps-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const app = running.find(({ id }) => id === $<HTMLSelectElement>("running").value);
  if (app && !config.seenApps.some(({ id }) => id === app.id)) {
    setApp(app, true, true);
  }
});
$("grant").addEventListener("click", async () => {
  await invoke("permission", { prompt: true });
  invoke("open_permission_settings");
});

onConfig((c) => {
  if (pending === 0) {
    config = c;
    render();
  }
});
render();
window.addEventListener("languagechange", render);
loadRunning();
// apps opened since, and access granted in System Settings, outside this window
window.addEventListener("focus", loadRunning);
checkPermission();
setInterval(checkPermission, 2000);
