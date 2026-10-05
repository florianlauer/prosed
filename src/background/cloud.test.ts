import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "../settings.ts";
import { check, rewrite, formality, type Generate } from "../check.ts";

test("the service worker routes grammar, rewrite and meter requests through saved BYOK settings", async () => {
  const local: Record<string, unknown> = {};
  const sync: Record<string, unknown> = {
    ...defaultSettings,
    provider: "openai",
    cloudConfigs: { openai: { model: "my-model" } },
  };
  let listener: (
    request: unknown,
    sender: unknown,
    reply: (answer: any) => void,
  ) => void;
  const trusted = {
    id: "extension-id",
    url: "chrome-extension://extension-id/src/options/index.html",
  };
  const content = {
    id: "extension-id",
    url: "https://example.com",
    tab: { id: 1 },
    frameId: 0,
  };
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  globalThis.chrome = {
    action: { onClicked: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        get: async (key: string) => ({ [key]: local[key] }),
        set: async (values: object) => Object.assign(local, values),
        remove: async (key: string) => {
          delete local[key];
        },
      },
      sync: { get: async (defaults: object) => ({ ...defaults, ...sync }) },
    },
    runtime: {
      id: "extension-id",
      getURL: (path: string) => `chrome-extension://extension-id/${path}`,
      onMessage: {
        addListener: (handle: typeof listener) => {
          listener = handle;
        },
      },
    },
  } as any;
  const send = (request: object, sender = trusted): Promise<any> =>
    new Promise((resolve) => listener(request, sender, resolve));
  try {
    await import("./index.ts");
    assert.match(
      (
        await send(
          { type: "cloud.keySave", provider: "openai", apiKey: "test-key" },
          content,
        )
      ).error,
      /settings/,
    );
    assert.deepEqual(
      await send({
        type: "cloud.keySave",
        provider: "openai",
        apiKey: "test-key",
      }),
      { ok: true },
    );
    assert.deepEqual(
      await send({ type: "cloud.keyStatus", provider: "openai" }),
      { configured: true },
    );
    const requests: { model: string; prompt: string }[] = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/chat/completions");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-key",
      );
      const body = JSON.parse(String(init?.body));
      requests.push({ model: body.model, prompt: body.messages[0].content });
      const prompt = body.messages[0].content;
      const answer = prompt.includes('"variants"')
        ? { variants: ["Send the report today."] }
        : prompt.includes('"formality"')
          ? { formality: 3 }
          : { correctedText: "I am here." };
      return Response.json({
        choices: [{ message: { content: JSON.stringify(answer) } }],
      });
    };
    const generate: Generate = async ({ channel, prompt, schema }) => {
      const response = await send(
        {
          type: "cloud.generate",
          channel,
          prompt,
          schema,
          provider: "custom",
          config: { baseUrl: "https://attacker.example/v1" },
        },
        content,
      );
      if (response.error) throw new Error(response.error);
      return response.value;
    };
    assert.equal(
      await check({ text: "I is here.", settings: sync as any, generate }),
      "I am here.",
    );
    assert.deepEqual(
      (
        await rewrite({
          text: "Please send the report today.",
          tone: "clearer",
          settings: sync as any,
          generate,
        })
      ).variants,
      ["Send the report today."],
    );
    assert.equal(
      await formality({
        text: "Please send the report today.",
        settings: sync as any,
        generate,
      }),
      3,
    );
    assert.equal(requests.length, 3);
    assert.ok(requests.every((request) => request.model === "my-model"));
    assert.equal(sync.apiKey, undefined);
    assert.deepEqual(
      await send({
        type: "cloud.test",
        provider: "openai",
        config: { model: "my-model" },
      }),
      { ok: true },
    );
    assert.match(
      (
        await send(
          {
            type: "cloud.test",
            provider: "openai",
            config: { model: "my-model" },
          },
          content,
        )
      ).error,
      /settings/,
    );
    globalThis.fetch = async () =>
      Response.json({ error: { message: "test-key" } }, { status: 401 });
    const error = await send(
      { type: "cloud.generate", channel: "check", prompt: "test", schema: {} },
      content,
    );
    assert.match(error.error, /401/);
    assert.ok(!error.error.includes("test-key"));
    assert.deepEqual(
      await send({ type: "cloud.keyRemove", provider: "openai" }),
      { ok: true },
    );
    assert.deepEqual(
      await send({ type: "cloud.keyStatus", provider: "openai" }),
      { configured: false },
    );
    assert.match(
      (
        await send(
          {
            type: "cloud.generate",
            channel: "check",
            prompt: "test",
            schema: {},
          },
          content,
        )
      ).error,
      /API key/,
    );
    sync.provider = "local";
    assert.match(
      (
        await send(
          {
            type: "cloud.generate",
            channel: "check",
            prompt: "test",
            schema: {},
          },
          content,
        )
      ).error,
      /provider/,
    );
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});
