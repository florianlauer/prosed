// The few chrome.* calls the extension's settings code makes, answered by the app, so
// src/settings.ts and the options page run unchanged. Imported first by every page.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Handlers, Message } from "../../src/messages.ts";
import { version } from "../src-tauri/tauri.conf.json";
import { getConfig, saveConfig } from "./api.ts";

type Listener = (changes: object, area: string) => void;
const listeners = new Set<Listener>();
listen("config", () => listeners.forEach((listener) => listener({}, "sync")));

const load = (body: object) =>
  invoke("ollama_generate", { channel: "switch", body: { prompt: "", stream: false, ...body } });

// The options page's messages; the rest go to the extension's service worker only.
const handlers: Handlers<"ollama.list" | "ollama.switch"> = {
  "ollama.list": () =>
    invoke<string[]>("ollama_models").then(
      (names) => ({ models: names.map((name) => ({ name })) }),
      () => null,
    ),
  "ollama.switch": async ({ data: { from, to } }) => {
    // as in the extension: free the previous model, then load the new one
    await (from ? load({ model: from, keep_alive: 0 }) : null)?.catch(() => {});
    if (to === null) return { ok: true };
    return load({ model: to, keep_alive: -1 }).then(
      () => ({ ok: true as const }),
      (e) => ({ error: String(e) }),
    );
  },
};

const sendMessage = async (message: Message) => {
  const handle = handlers[message.type as keyof typeof handlers] as ((m: Message) => Promise<unknown>) | undefined;
  return handle ? handle(message) : null;
};

globalThis.chrome = {
  storage: {
    sync: {
      get: async (defaults: object) => ({ ...defaults, ...(await getConfig()).core }),
      set: (changes: object) => saveConfig({ core: changes }),
    },
    onChanged: {
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
    },
  },
  runtime: { getManifest: () => ({ version }), sendMessage },
} as unknown as typeof chrome;
