import ollama, { type GenerateResponse, Ollama } from "ollama/browser";
import type { Channel } from "../check";
import type { Handlers, Message, Messages } from "../messages";
import { geminiAvailability, geminiGenerate } from "../gemini.ts";
import {
  cloudGenerate,
  cloudTestPrompt,
  cloudTestSchema,
  isCloudProvider,
  verifyCloudTest,
} from "../cloud.ts";
import {
  cloudKeyStatus,
  getCloudKey,
  protectCloudKeys,
  removeCloudKey,
  requireCloudSettingsSender,
  saveCloudKey,
} from "../cloudCredentials.ts";
import { loadSettings, onSettingsChange } from "../settings.ts";
import { setLocale, t } from "../i18n/index.ts";

const translateAction = async () => {
  setLocale((await loadSettings()).uiLocale);
  await chrome.action.setTitle({ title: t("settingsTitle") });
};
void translateAction();
onSettingsChange(() => void translateAction());

// One per tab and kind of request, so a new check cancels the previous check in the same
// tab but not a rewrite the user is waiting for, nor another tab's request.
// ponytail: entries for closed tabs stay until the service worker stops, a few bytes each
const controllers = new Map<string, AbortController>();

const restart = (
  sender: chrome.runtime.MessageSender,
  channel: Channel = "check",
) => {
  const key = `${sender.tab?.id}:${sender.frameId}:${channel}`;
  controllers.get(key)?.abort();
  const controller = new AbortController();
  controllers.set(key, controller);
  return controller.signal;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ollamaGenerate = (
  args: Parameters<typeof ollama.generate>[0],
  signal: AbortSignal,
): Promise<GenerateResponse> => {
  const ollama = new Ollama({
    fetch: (input, init) => fetch(input, { ...init, signal }),
  });
  return ollama.generate(args).catch((e) => {
    console.warn(e);
    const message: string | undefined = (e as any)?.message;
    if (message === "unexpected server status: llm server loading model") {
      return sleep(3000).then(() => {
        if (signal.aborted) {
          throw new Error("Aborted");
        }
        return ollamaGenerate(args, signal);
      });
    }
    throw e;
  });
};

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
void protectCloudKeys();

const handlers: Handlers<keyof Messages> = {
  "cloud.generate": async ({ channel, prompt, schema }, sender) => {
    const signal = restart(sender, channel);
    const settings = await loadSettings();
    if (!isCloudProvider(settings.provider))
      throw new Error("Choose an API provider in settings.");
    const config = settings.cloudConfigs[settings.provider];
    if (!config) throw new Error("Configure this API provider in settings.");
    try {
      const value = await cloudGenerate({
        provider: settings.provider,
        config,
        apiKey: await getCloudKey(settings.provider),
        prompt,
        schema,
        signal,
      });
      return { value };
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
  },
  "cloud.keyStatus": async ({ provider }, sender) => {
    requireCloudSettingsSender(sender);
    return { configured: await cloudKeyStatus(provider) };
  },
  "cloud.keySave": async ({ provider, apiKey }, sender) => {
    requireCloudSettingsSender(sender);
    await saveCloudKey({ provider, apiKey });
    return { ok: true };
  },
  "cloud.keyRemove": async ({ provider }, sender) => {
    requireCloudSettingsSender(sender);
    await removeCloudKey(provider);
    return { ok: true };
  },
  "cloud.test": async ({ provider, config, apiKey }, sender) => {
    requireCloudSettingsSender(sender);
    const answer = await cloudGenerate({
      provider,
      config,
      apiKey: apiKey?.trim() || (await getCloudKey(provider)),
      prompt: cloudTestPrompt,
      schema: cloudTestSchema,
      signal: restart(sender, "test"),
    });
    verifyCloudTest(answer);
    return { ok: true };
  },
  "options.open": async () => chrome.runtime.openOptionsPage(),

  "ollama.list": () => ollama.list().catch(() => null),

  "ollama.generate": ({ channel, data }, sender) =>
    ollamaGenerate(data, restart(sender, channel)).catch((e) => ({
      error: String(e?.message ?? e),
    })),

  // The default client has no abort signal, so a check starting meanwhile can't cancel this.
  "ollama.switch": ({ data: { from, to } }) =>
    Promise.resolve(
      from && ollama.generate({ model: from, prompt: "", keep_alive: 0 }),
    )
      .catch(() => {}) // not loaded or not installed: nothing to free
      .then(() =>
        to ? ollama.generate({ model: to, prompt: "", keep_alive: -1 }) : null,
      )
      .then(
        () => ({ ok: true as const }),
        (e) => ({ error: String(e?.message ?? e) }),
      ),

  "gemini.supported": () => geminiAvailability().then((a) => a === "available"),

  "gemini.ready": async () => {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) =>
        tab.id === undefined
          ? null
          : chrome.tabs
              .sendMessage(tab.id, { type: "gemini.ready" })
              .catch(() => {}),
      ),
    );
  },

  "gemini.generate": ({ channel, data }, sender) =>
    geminiGenerate({ ...data, signal: restart(sender, channel) }),
};

chrome.runtime.onMessage.addListener(
  (request: Message, sender, sendResponse) => {
    const handle = handlers[request.type] as
      | ((
          request: Message,
          sender: chrome.runtime.MessageSender,
        ) => Promise<unknown>)
      | undefined;
    if (!handle) {
      return;
    }
    handle(request, sender).then(sendResponse, (error) =>
      sendResponse({
        error: error instanceof Error ? error.message : "The request failed.",
      }),
    );
    // the answer comes later
    return true;
  },
);
