import ollama, { GenerateResponse, Ollama } from "ollama/browser";
import type { Channel } from "../check";
import type { Handlers, Message, Messages } from "../messages";
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

const restart = (sender: chrome.runtime.MessageSender, channel: Channel = "check") => {
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

const handlers: Handlers<keyof Messages> = {
  "options.open": async () => chrome.runtime.openOptionsPage(),

  "ollama.list": () => ollama.list().catch(() => null),

  "ollama.generate": ({ channel, data }, sender) =>
    ollamaGenerate(data, restart(sender, channel)).catch((e) => ({ error: String(e?.message ?? e) })),

  // The default client has no abort signal, so a check starting meanwhile can't cancel this.
  "ollama.switch": ({ data: { from, to } }) =>
    Promise.resolve(from && ollama.generate({ model: from, prompt: "", keep_alive: 0 }))
      .catch(() => {}) // not loaded or not installed: nothing to free
      .then(() => ollama.generate({ model: to, prompt: "", keep_alive: -1 }))
      .then(() => ({ ok: true as const }), (e) => ({ error: String(e?.message ?? e) })),

  // it resolves "unavailable" rather than failing; a model still to download is fetched by the first check
  "gemini.supported": () => LanguageModel.availability().then((a) => a !== "unavailable", () => false),

  "gemini.generate": async ({ channel, data }, sender) => {
    const signal = restart(sender, channel);
    try {
      const session = await LanguageModel.create({ signal });
      return await session.prompt(data.text, { signal, ...data });
    } catch (e) {
      // aborted, or unavailable before a session exists: answer anyway, or the tab waits forever
      console.warn(e);
      return null;
    }
  },
};

chrome.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  const handle = handlers[request.type] as
    | ((request: Message, sender: chrome.runtime.MessageSender) => Promise<unknown>)
    | undefined;
  if (!handle) {
    return;
  }
  handle(request, sender).then(sendResponse);
  // the answer comes later
  return true;
});
