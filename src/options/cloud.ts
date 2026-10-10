import {
  cloudBaseUrl,
  cloudProviders,
  isCloudProvider,
  type CloudConfig,
  type CloudProvider,
} from "../cloud.ts";
import { send } from "../messages.ts";
import { loadSettings, onSettingsChange, saveSettings } from "../settings.ts";

export const initCloudSettings = async () => {
  let settings = await loadSettings();
  const localSection = document
    .getElementById("model-title")!
    .closest("section")!;
  const section = document.createElement("section");
  section.className = "opt__section opt__cloud";
  section.setAttribute("aria-labelledby", "provider-title");
  section.innerHTML = `
    <h2 id="provider-title">AI provider</h2>
    <p class="opt__hint" id="provider-active" role="status"></p>
    <label class="opt__row"><span>Provider</span><select class="opt__field" id="provider"></select></label>
    <form id="cloud-form" hidden>
      <p class="opt__hint">Your text is sent directly to the selected provider for checks and rewrites. Requests are billed to your API account.</p>
      <label class="opt__row"><span>Model ID</span><input class="opt__field" id="cloud-model" autocomplete="off" spellcheck="false" required /></label>
      <label class="opt__row" id="cloud-url-row" hidden><span>API base URL</span><input class="opt__field" id="cloud-url" type="url" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" /></label>
      <label class="opt__row"><span>API key</span><input class="opt__field" id="cloud-key" type="password" autocomplete="new-password" spellcheck="false" /></label>
      <p class="opt__hint" id="cloud-key-status"></p>
      <p class="opt__hint" id="cloud-storage"></p>
      <div class="opt__cloud-actions">
        <button class="opt__button" type="submit">Save and use</button>
        <button class="opt__button" type="button" id="cloud-test">Test connection</button>
        <button class="aig-link" type="button" id="cloud-remove" disabled>Remove key</button>
      </div>
      <p class="opt__hint">The connection test sends a short sample and may incur a small API charge.</p>
    </form>
    <p class="opt__load" id="cloud-result" role="status" hidden></p>`;
  localSection.before(section);
  const $ = <T extends HTMLElement>(id: string) =>
    section.querySelector<T>(`#${id}`)!;
  const provider = $<HTMLSelectElement>("provider");
  const model = $<HTMLInputElement>("cloud-model");
  const url = $<HTMLInputElement>("cloud-url");
  const key = $<HTMLInputElement>("cloud-key");
  const form = $<HTMLFormElement>("cloud-form");
  const remove = $<HTMLButtonElement>("cloud-remove");
  const desktop = !chrome.permissions;
  let configured = false;
  let busy = false;
  let revision = 0;
  provider.replaceChildren(
    new Option("Local models", "local"),
    ...Object.entries(cloudProviders).map(
      ([id, info]) => new Option(info.name, id),
    ),
  );
  provider.value = settings.provider;
  $("cloud-storage").textContent = desktop
    ? "Keys are stored in your operating system's keychain. They are never written to the settings file."
    : "Keys stay in this browser profile, in local extension storage. They are not synced and websites cannot read them.";

  const active = () => {
    $("provider-active").textContent = isCloudProvider(settings.provider)
      ? `Currently using ${cloudProviders[settings.provider].name} · ${settings.cloudConfigs[settings.provider]?.model || "configure a model"}`
      : "Currently using local models. Your text stays on this device.";
  };
  const result = (message: string, state: "loading" | "ready" | "error") => {
    const status = $("cloud-result");
    status.hidden = false;
    status.dataset.state = state;
    status.textContent = message;
  };
  const setBusy = (value: boolean) => {
    busy = value;
    for (const field of section.querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >("input, button, select"))
      field.disabled = value;
    remove.disabled = value || !configured;
  };
  const unwrap = (reply: { ok: true } | { error: string } | null) => {
    if (!reply) throw new Error("The provider request failed.");
    if ("error" in reply) throw new Error(reply.error);
  };
  const refreshKey = async () => {
    if (!isCloudProvider(provider.value)) return;
    const id = provider.value;
    const current = ++revision;
    const reply = await send({ type: "cloud.keyStatus", provider: id });
    if (current !== revision || id !== provider.value) return;
    if ("error" in reply) throw new Error(reply.error);
    configured = reply.configured;
    key.placeholder = configured
      ? "Leave blank to keep the saved key"
      : "Paste your API key";
    $("cloud-key-status").textContent = configured
      ? "An API key is saved for this provider."
      : "No API key saved for this provider.";
    remove.disabled = busy || !configured;
  };
  const renderProvider = async () => {
    ++revision;
    key.value = "";
    configured = false;
    remove.disabled = true;
    $("cloud-result").hidden = true;
    const remote = isCloudProvider(provider.value);
    form.hidden = !remote;
    localSection.hidden = remote;
    if (!remote) return;
    const id = provider.value as CloudProvider;
    const config = settings.cloudConfigs[id];
    model.value = config?.model ?? cloudProviders[id].model;
    url.value = config?.baseUrl ?? "";
    $("cloud-url-row").hidden = id !== "custom";
    url.required = id === "custom";
    $("cloud-key-status").textContent = "Checking saved key…";
    await refreshKey();
  };
  const configFromForm = (): {
    provider: CloudProvider;
    config: CloudConfig;
  } => {
    if (!isCloudProvider(provider.value))
      throw new Error("Choose an API provider.");
    if (!model.value.trim()) throw new Error("Enter a model ID.");
    if (!key.value.trim() && !configured) throw new Error("Enter an API key.");
    const config: CloudConfig = {
      model: model.value.trim(),
      ...(provider.value === "custom" ? { baseUrl: url.value.trim() } : {}),
    };
    cloudBaseUrl({ provider: provider.value, config });
    return { provider: provider.value, config };
  };
  const grantAccess = ({
    provider: id,
    config,
  }: {
    provider: CloudProvider;
    config: CloudConfig;
  }) => {
    if (desktop) return Promise.resolve(true);
    const origin = new URL(cloudBaseUrl({ provider: id, config })).origin;
    // Called directly from the click so Chrome retains the user activation for its prompt.
    return chrome.permissions.request({ origins: [`${origin}/*`] });
  };
  const run = async (action: "save" | "test") => {
    if (busy || !form.reportValidity()) return;
    try {
      const draft = configFromForm();
      const apiKey = key.value.trim();
      const permission = grantAccess(draft);
      setBusy(true);
      result(
        action === "test" ? "Testing connection…" : "Saving provider…",
        "loading",
      );
      if (!(await permission))
        throw new Error("Allow access to this API host to use the provider.");
      if (action === "test") {
        unwrap(
          await send({
            type: "cloud.test",
            ...draft,
            ...(apiKey ? { apiKey } : {}),
          }),
        );
        result(
          "Connection successful. The model returned a grammar response.",
          "ready",
        );
      } else {
        if (apiKey)
          unwrap(
            await send({
              type: "cloud.keySave",
              provider: draft.provider,
              apiKey,
            }),
          );
        const latest = await loadSettings();
        await saveSettings({
          provider: draft.provider,
          cloudConfigs: {
            ...latest.cloudConfigs,
            [draft.provider]: draft.config,
          },
        });
        settings = await loadSettings();
        key.value = "";
        await refreshKey();
        active();
        result(
          `${cloudProviders[draft.provider].name} is selected. Checks and rewrites use your API key.`,
          "ready",
        );
      }
    } catch (error) {
      result(
        error instanceof Error ? error.message : "The provider request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void run("save");
  });
  $("cloud-test").addEventListener("click", () => void run("test"));
  provider.addEventListener("change", async () => {
    if (busy) return;
    try {
      await renderProvider();
      if (provider.value === "local") {
        await saveSettings({ provider: "local" });
        settings = await loadSettings();
        active();
      }
    } catch (error) {
      result(
        error instanceof Error ? error.message : "Couldn't change provider.",
        "error",
      );
    }
  });
  remove.addEventListener("click", async () => {
    if (!isCloudProvider(provider.value) || busy) return;
    const id = provider.value;
    const wasActive = settings.provider === id;
    setBusy(true);
    try {
      unwrap(await send({ type: "cloud.keyRemove", provider: id }));
      key.value = "";
      if (wasActive) await saveSettings({ provider: "local" });
      settings = await loadSettings();
      if (wasActive) {
        provider.value = "local";
        await renderProvider();
      } else {
        await refreshKey();
      }
      active();
      result(
        "The API key was removed. You can add another key or choose local models.",
        "ready",
      );
    } catch (error) {
      result(
        error instanceof Error ? error.message : "Couldn't remove the key.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  });
  onSettingsChange((next) => {
    settings = next;
    active();
  });
  active();
  try {
    await renderProvider();
  } catch (error) {
    result(
      error instanceof Error
        ? error.message
        : "Couldn't load provider settings.",
      "error",
    );
  }
};
