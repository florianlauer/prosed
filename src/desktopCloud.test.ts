import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "./settings.ts";
import { generate, generateCloud } from "../desktop/src/api.ts";

test("desktop generation routes the configured provider to Rust without exposing saved keys", async () => {
  const settings = {
    ...defaultSettings,
    provider: "anthropic",
    cloudConfigs: { anthropic: { model: "my-claude" } },
  };
  const calls: { command: string; args: any }[] = [];
  const originalChrome = globalThis.chrome;
  const originalWindow = globalThis.window;
  globalThis.chrome = {
    storage: { sync: { get: async () => settings } },
  } as any;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command: string, args: any) => {
        calls.push({ command, args });
        if (command === "cloud_send")
          return {
            content: [{ type: "text", text: '{"correctedText":"Hello."}' }],
          };
        return { response: '{"correctedText":"Local."}' };
      },
    },
  } as any;
  try {
    const request = {
      channel: "check" as const,
      model: "local-model",
      prompt: "Fix hello",
      schema: { type: "object" },
    };
    assert.deepEqual(await generate(request), { correctedText: "Hello." });
    assert.equal(calls[0].command, "cloud_send");
    assert.equal(calls[0].args.request.provider, "anthropic");
    assert.equal(calls[0].args.request.body.model, "my-claude");
    assert.equal(calls[0].args.apiKey, undefined);
    assert.ok(!JSON.stringify(calls[0].args).includes("Authorization"));
    assert.deepEqual(
      await generateCloud({
        provider: "anthropic",
        config: { model: "draft-model" },
        channel: "test",
        apiKey: "draft-key",
        prompt: "sample",
        schema: {},
      }),
      { correctedText: "Hello." },
    );
    assert.equal(calls[1].args.request.body.model, "draft-model");
    assert.equal(calls[1].args.apiKey, "draft-key");
    settings.provider = "local";
    assert.deepEqual(await generate(request), { correctedText: "Local." });
    assert.equal(calls[2].command, "ollama_generate");
    assert.equal(calls[2].args.body.model, "local-model");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.window = originalWindow;
  }
});
