// The Rust side: settings, Ollama, and the focused field of the app being typed in.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Generate } from "../../src/check.ts";
import { loadSettings, type Settings } from "../../src/settings.ts";
import {
  buildCloudRequest,
  isCloudProvider,
  parseCloudResponse,
  type CloudConfig,
  type CloudProvider,
} from "../../src/cloud.ts";

export type App = { id: string; name: string };
export type Rect = { x: number; y: number; width: number; height: number };

export type Config = {
  checkAsYouType: boolean;
  shortcutEnabled: boolean;
  shortcut: string;
  disabledApps: string[];
  seenApps: App[];
  // the extension's settings, read through src/settings.ts
  core: Partial<Settings> | null;
};

export const getConfig = () => invoke<Config>("get_config");
// only the keys that change
export const saveConfig = (changes: Partial<Config>) =>
  invoke("save_config", { changes });
export const onConfig = (listener: (config: Config) => void) =>
  listen<Config>("config", (e) => listener(e.payload));

// The extension follows the page's colours; the app has none, so it follows the system's.
export const followTheme = () => {
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const theme = dark.matches ? "dark" : "light";
    for (const el of [
      document.body,
      ...document.querySelectorAll<HTMLElement>("body > .aig-root"),
    ]) {
      el.dataset.theme = theme;
    }
  };
  apply();
  dark.addEventListener("change", apply);
};

// The extension's Ollama request, sent from Rust. A new request on a channel cancels the
// previous one there.
export const generate: Generate = async ({
  channel,
  model,
  prompt,
  schema,
}) => {
  const settings = await loadSettings();
  if (isCloudProvider(settings.provider)) {
    const config = settings.cloudConfigs[settings.provider];
    if (!config) throw new Error("Configure this API provider in settings.");
    return generateCloud({
      provider: settings.provider,
      config,
      channel,
      prompt,
      schema,
    });
  }
  const { response } = await invoke<{ response: string }>("ollama_generate", {
    channel,
    body: {
      model,
      prompt,
      format: schema,
      stream: false,
      think: false,
      keep_alive: -1,
      options: { temperature: 0 },
    },
  });
  return JSON.parse(response);
};

export const generateCloud = async ({
  provider,
  config,
  channel,
  prompt,
  schema,
  apiKey,
}: {
  provider: CloudProvider;
  config: CloudConfig;
  channel: string;
  prompt: string;
  schema: Record<string, unknown>;
  apiKey?: string;
}) => {
  const request = buildCloudRequest({ provider, config, prompt, schema });
  const data = await invoke("cloud_send", {
    channel,
    request,
    ...(apiKey ? { apiKey } : {}),
  });
  return parseCloudResponse({ provider, data });
};
