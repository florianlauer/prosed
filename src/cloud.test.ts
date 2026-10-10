import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cloudProviders,
  buildCloudRequest,
  cloudGenerate,
  parseCloudResponse,
} from "./cloud.ts";

const schema = {
  type: "object",
  properties: { correctedText: { type: "string" } },
  required: ["correctedText"],
};
const request = { model: "my-model", prompt: "Fix this sentence.", schema };

test("every provider builds an authenticated request to its own endpoint", () => {
  for (const provider of Object.keys(cloudProviders)) {
    const built = buildCloudRequest({
      provider,
      config: {
        model: "my-model",
        baseUrl: provider === "custom" ? "https://example.com/v1/" : "",
      },
      ...request,
    });
    assert.ok(built.url.startsWith("https://"));
    assert.equal(built.provider, provider);
    assert.ok((built.url + JSON.stringify(built.body)).includes("my-model"));
  }
});

test("OpenAI compatible APIs receive a JSON instruction without unsupported model options", () => {
  const built = buildCloudRequest({
    provider: "openai",
    config: { model: "gpt-5-mini" },
    ...request,
  });
  assert.equal(built.url, "https://api.openai.com/v1/chat/completions");
  assert.match(JSON.stringify(built.body), /JSON/);
  assert.equal(built.body.temperature, undefined);
});

test("Anthropic and Gemini use their native request formats", () => {
  const anthropic = buildCloudRequest({
    provider: "anthropic",
    config: { model: "claude-sonnet-4-6" },
    ...request,
  });
  assert.equal(anthropic.url, "https://api.anthropic.com/v1/messages");
  assert.equal(anthropic.body.max_tokens, 4096);
  const gemini = buildCloudRequest({
    provider: "gemini-api",
    config: { model: "gemini-2.5-flash" },
    ...request,
  });
  assert.match(gemini.url, /models\/gemini-2.5-flash:generateContent$/);
  assert.equal(
    (gemini.body.generationConfig as any).responseMimeType,
    "application/json",
  );
});

test("custom endpoints reject insecure remote URLs and embedded credentials", () => {
  for (const baseUrl of [
    "http://example.com/v1",
    "https://user:secret@example.com",
    "https://example.com?key=secret",
    "file:///tmp/api",
    "",
  ]) {
    assert.throws(() =>
      buildCloudRequest({
        provider: "custom",
        config: { model: "model", baseUrl },
        ...request,
      }),
    );
  }
  assert.equal(
    buildCloudRequest({
      provider: "custom",
      config: { model: "model", baseUrl: "http://127.0.0.1:8080/v1/" },
      ...request,
    }).url,
    "http://127.0.0.1:8080/v1/chat/completions",
  );
  assert.throws(() =>
    buildCloudRequest({
      provider: "unknown",
      config: { model: "model" },
      ...request,
    }),
  );
  assert.throws(() =>
    buildCloudRequest({
      provider: "openai",
      config: { model: " " },
      ...request,
    }),
  );
});

test("responses from all protocols produce the same parsed grammar result", () => {
  const answer = { correctedText: "I am here." };
  assert.deepEqual(
    parseCloudResponse({
      provider: "openai",
      data: { choices: [{ message: { content: JSON.stringify(answer) } }] },
    }),
    answer,
  );
  assert.deepEqual(
    parseCloudResponse({
      provider: "anthropic",
      data: {
        content: [
          { type: "thinking", thinking: "hidden" },
          {
            type: "text",
            text: "```json\n" + JSON.stringify(answer) + "\n```",
          },
        ],
      },
    }),
    answer,
  );
  assert.deepEqual(
    parseCloudResponse({
      provider: "gemini-api",
      data: {
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "hidden" },
                { text: JSON.stringify(answer) },
              ],
            },
          },
        ],
      },
    }),
    answer,
  );
  assert.throws(
    () => parseCloudResponse({ provider: "openai", data: { choices: [] } }),
    /empty/i,
  );
  assert.throws(
    () =>
      parseCloudResponse({
        provider: "openai",
        data: { choices: [{ message: { content: "not JSON" } }] },
      }),
    /JSON/i,
  );
});

test("malformed native responses produce an actionable empty-answer error", () => {
  for (const [provider, data] of [
    ["anthropic", { content: {} }],
    ["anthropic", { content: [null] }],
    ["gemini-api", { candidates: [{ content: { parts: {} } }] }],
  ] as const) {
    assert.throws(() => parseCloudResponse({ provider, data }), /empty answer/);
  }
});

test("cloud calls send credentials only in headers and propagate cancellation", async () => {
  const controller = new AbortController();
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://api.anthropic.com/v1/messages");
    assert.equal(new Headers(init?.headers).get("x-api-key"), "test-key");
    assert.equal(
      new Headers(init?.headers).get("anthropic-version"),
      "2023-06-01",
    );
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.ok(!init?.body?.toString().includes("test-key"));
    return Response.json({
      content: [{ type: "text", text: '{"correctedText":"Hello."}' }],
    });
  };
  assert.deepEqual(
    await cloudGenerate({
      provider: "anthropic",
      config: { model: "claude" },
      apiKey: "test-key",
      ...request,
      signal: controller.signal,
      fetcher,
    }),
    { correctedText: "Hello." },
  );
  controller.abort();
  await assert.rejects(
    cloudGenerate({
      provider: "openai",
      config: { model: "model" },
      apiKey: "key",
      ...request,
      signal: controller.signal,
      fetcher: async (_, init) => {
        init?.signal?.throwIfAborted();
        return Response.json({});
      },
    }),
    { name: "AbortError" },
  );
});

test("authentication, limits, and server errors never expose provider response secrets", async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(
      cloudGenerate({
        provider: "openai",
        config: { model: "model" },
        apiKey: "secret-key",
        ...request,
        fetcher: async () =>
          Response.json({ error: { message: "secret-key" } }, { status }),
      }),
      (error: Error) =>
        !error.message.includes("secret-key") &&
        error.message.includes(String(status)),
    );
  }
  await assert.rejects(
    cloudGenerate({
      provider: "openai",
      config: { model: "model" },
      apiKey: "",
      ...request,
    }),
    /API key/,
  );
});
