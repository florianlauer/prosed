// What the content script and the options page ask the service worker, and what each answer is.
// The desktop app answers the two Ollama ones itself (desktop/src/chrome.ts).
import type { GenerateRequest, GenerateResponse } from "ollama/browser";
import type { Channel } from "./check.ts";

export type Messages = {
  // content scripts can't open the options page themselves
  "options.open": { request: {}; reply: void };
  // the pulled models; null: Ollama isn't reachable
  "ollama.list": { request: {}; reply: { models: { name: string }[] } | null };
  // null: Ollama isn't reachable; error: e.g. "model not found" after picking a model that isn't pulled
  "ollama.generate": {
    request: { channel: Channel; data: GenerateRequest & { stream?: false } };
    reply: GenerateResponse | { error: string } | null;
  };
  // frees the previous model's memory, then loads the new one
  "ollama.switch": { request: { data: { from: string | null; to: string } }; reply: { ok: true } | { error: string } };
  "gemini.supported": { request: {}; reply: boolean };
  // Recheck tabs that were open before Chrome downloaded the model.
  "gemini.ready": { request: {}; reply: void };
  // null: the request was aborted; errors retain the browser's original reason
  "gemini.generate": {
    request: { channel: Channel; data: LanguageModelPromptOptions & { text: LanguageModelPrompt } };
    reply: string | { error: string } | null;
  };
};

export type Request<K extends keyof Messages> = { type: K } & Messages[K]["request"];
export type Reply<K extends keyof Messages> = Messages[K]["reply"];
export type Message = { [K in keyof Messages]: Request<K> }[keyof Messages];

// How a side answers the messages it handles.
export type Handlers<K extends keyof Messages> = {
  [T in K]: (request: Request<T>, sender: chrome.runtime.MessageSender) => Promise<Reply<T>>;
};

export const send = <K extends keyof Messages>(request: Request<K>): Promise<Reply<K>> =>
  chrome.runtime.sendMessage(request);
