import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCloudKey,
  saveCloudKey,
  removeCloudKey,
  cloudKeyStatus,
  requireCloudSettingsSender,
} from "./cloudCredentials.ts";

test("keys stay in trusted local storage and are never returned by status", async () => {
  const data: Record<string, string> = {};
  let access = "";
  globalThis.chrome = {
    extension: { inIncognitoContext: true },
    storage: {
      local: {
        setAccessLevel: async ({ accessLevel }: { accessLevel: string }) => {
          access = accessLevel;
        },
        set: async (values: object) => {
          Object.assign(data, values);
        },
        get: async (key: string) => ({ [key]: data[key] }),
        remove: async (key: string) => {
          delete data[key];
        },
      },
    },
  } as any;
  await saveCloudKey({ provider: "openai", apiKey: "  secret  " });
  assert.equal(access, "TRUSTED_CONTEXTS");
  assert.equal(await getCloudKey("openai"), "secret");
  assert.deepEqual(await cloudKeyStatus("openai"), {
    configured: true,
    temporary: false,
  });
  assert.deepEqual(await cloudKeyStatus("anthropic"), {
    configured: false,
    temporary: false,
  });
  await removeCloudKey("openai");
  assert.deepEqual(await cloudKeyStatus("openai"), {
    configured: false,
    temporary: false,
  });
  await assert.rejects(
    saveCloudKey({ provider: "openai", apiKey: " " }),
    /API key/,
  );
  await assert.rejects(
    saveCloudKey({ provider: "unknown", apiKey: "secret" }),
    /provider/i,
  );
});

test("only the extension settings page can manage keys or test draft endpoints", () => {
  globalThis.chrome = {
    runtime: {
      id: "extension-id",
      getURL: (path: string) => `chrome-extension://extension-id/${path}`,
    },
  } as any;
  assert.doesNotThrow(() =>
    requireCloudSettingsSender({
      id: "extension-id",
      url: "chrome-extension://extension-id/src/options/index.html",
      tab: { id: 1 } as any,
    }),
  );
  for (const sender of [
    { id: "extension-id", url: "https://example.com" },
    { id: "extension-id", url: "chrome-extension://extension-id/other.html" },
    {
      id: "another-id",
      url: "chrome-extension://extension-id/src/options/index.html",
    },
    {},
  ])
    assert.throws(() => requireCloudSettingsSender(sender), /settings/);
});

test("browsers without trusted local storage never put keys in content-accessible storage", async (t) => {
  let touchedLocal = false;
  const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "indexedDB", original);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  });
  globalThis.chrome = {
    storage: {
      local: {
        set: async () => {
          touchedLocal = true;
        },
        get: async () => {
          touchedLocal = true;
          return {};
        },
        remove: async () => {
          touchedLocal = true;
        },
      },
    },
  } as any;
  const unavailable = {
    open() {
      throw new Error("Credential storage unavailable");
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: unavailable,
  });
  for (const operation of [
    () => saveCloudKey({ provider: "openai", apiKey: "secret" }),
    () => getCloudKey("openai"),
    () => removeCloudKey("openai"),
  ])
    await assert.rejects(operation, /Credential storage unavailable/);
  assert.equal(touchedLocal, false);
});

test("private Firefox keys use trusted session storage and disappear when it clears", async (t) => {
  const originalChrome = globalThis.chrome;
  t.after(() => {
    globalThis.chrome = originalChrome;
  });
  const data: Record<string, string> = {};
  globalThis.chrome = {
    extension: { inIncognitoContext: true },
    storage: {
      local: {
        get: async () => {
          throw new Error("Content-accessible storage must not be used");
        },
        set: async () => {
          throw new Error("Content-accessible storage must not be used");
        },
        remove: async () => {
          throw new Error("Content-accessible storage must not be used");
        },
      },
      session: {
        get: async (key: string) => ({ [key]: data[key] }),
        set: async (values: object) => {
          Object.assign(data, values);
        },
        remove: async (key: string) => {
          delete data[key];
        },
      },
    },
  } as any;
  await saveCloudKey({ provider: "openai", apiKey: "private-key" });
  assert.equal(await getCloudKey("openai"), "private-key");
  assert.deepEqual(await cloudKeyStatus("openai"), {
    configured: true,
    temporary: true,
  });
  await removeCloudKey("openai");
  assert.equal(await getCloudKey("openai"), "");
  await saveCloudKey({ provider: "openai", apiKey: "private-key" });
  for (const key of Object.keys(data)) delete data[key];
  assert.deepEqual(await cloudKeyStatus("openai"), {
    configured: false,
    temporary: true,
  });
});
