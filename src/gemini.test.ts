import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { geminiAvailability, geminiGenerate, geminiVerify } from "./gemini.ts";

const mockLanguageModel = (t: TestContext, api?: object) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "LanguageModel");
  Object.defineProperty(globalThis, "LanguageModel", {
    configurable: true,
    value: api,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "LanguageModel", original);
    else Reflect.deleteProperty(globalThis, "LanguageModel");
  });
};

test("browsers without the Prompt API report unavailable without throwing", async (t) => {
  mockLanguageModel(t);
  assert.equal(await geminiAvailability(), "unavailable");
});

test("a rejected availability check reports unavailable", async (t) => {
  mockLanguageModel(t, {
    availability: async () => {
      throw new Error("Unsupported language");
    },
  });
  assert.equal(await geminiAvailability(), "unavailable");
});

test("availability preserves download states and checks French and English", async (t) => {
  let state = "unavailable";
  mockLanguageModel(t, {
    availability: async (options: any) => {
      assert.deepEqual(options.expectedInputs, [
        { type: "text", languages: ["en", "fr"] },
      ]);
      assert.deepEqual(options.expectedOutputs, [
        { type: "text", languages: ["en", "fr"] },
      ]);
      return state;
    },
  });
  for (state of ["available", "downloadable", "downloading", "unavailable"]) {
    assert.equal(await geminiAvailability(), state);
  }
});

test("generation forwards the schema and abort signal, then frees the session", async (t) => {
  const signal = new AbortController().signal;
  const schema = { type: "object" };
  let destroyed = false;
  mockLanguageModel(t, {
    create: async (options: any) => {
      assert.equal(options.signal, signal);
      assert.deepEqual(options.expectedOutputs[0].languages, ["en", "fr"]);
      return {
        prompt: async (text: string, options: any) => {
          assert.equal(text, "Fix this sentence.");
          assert.equal(options.responseConstraint, schema);
          assert.equal(options.signal, signal);
          return '{"correctedText":"Fixed."}';
        },
        destroy: () => {
          destroyed = true;
        },
      };
    },
  });
  assert.equal(
    await geminiGenerate({
      text: "Fix this sentence.",
      signal,
      responseConstraint: schema,
    }),
    '{"correctedText":"Fixed."}',
  );
  assert.equal(destroyed, true);
});

test("a failed prompt returns its original error and frees its session", async (t) => {
  let destroyed = false;
  mockLanguageModel(t, {
    create: async () => ({
      prompt: async () => {
        throw new DOMException(
          "This schema is not supported",
          "NotSupportedError",
        );
      },
      destroy: () => {
        destroyed = true;
      },
    }),
  });
  assert.deepEqual(
    await geminiGenerate({
      text: "Hello",
      signal: new AbortController().signal,
    }),
    { error: "NotSupportedError: This schema is not supported" },
  );
  assert.equal(destroyed, true);
});

test("an unsupported JSON constraint retries in a fresh session with the schema in the prompt", async (t) => {
  const schema = {
    type: "object",
    properties: { correctedText: { type: "string" } },
  };
  const signal = new AbortController().signal;
  let created = 0;
  let destroyed = 0;
  mockLanguageModel(t, {
    create: async () => {
      const attempt = ++created;
      return {
        prompt: async (text: string, options: any) => {
          assert.equal(options.signal, signal);
          if (attempt === 1) {
            assert.equal(options.responseConstraint, schema);
            throw new DOMException(
              "The request is invalid",
              "NotSupportedError",
            );
          }
          assert.equal(destroyed, 1);
          assert.equal(options.responseConstraint, undefined);
          assert.ok(text.startsWith("Fix this sentence."));
          assert.ok(text.includes(JSON.stringify(schema)));
          assert.ok(text.includes("JSON"));
          return '{"correctedText":"Fixed."}';
        },
        destroy: () => {
          destroyed++;
        },
      };
    },
  });
  assert.equal(
    await geminiGenerate({
      text: "Fix this sentence.",
      signal,
      responseConstraint: schema,
    }),
    '{"correctedText":"Fixed."}',
  );
  assert.equal(created, 2);
  assert.equal(destroyed, 2);
});

test("unrelated prompt failures do not trigger a constraint retry", async (t) => {
  let created = 0;
  mockLanguageModel(t, {
    create: async () => {
      created++;
      return {
        prompt: async () => {
          throw new DOMException("Model failed", "OperationError");
        },
        destroy: () => {},
      };
    },
  });
  assert.deepEqual(
    await geminiGenerate({
      text: "Hello",
      signal: new AbortController().signal,
      responseConstraint: { type: "object" },
    }),
    { error: "OperationError: Model failed" },
  );
  assert.equal(created, 1);
});

test("an aborted constraint request does not retry", async (t) => {
  const controller = new AbortController();
  let created = 0;
  mockLanguageModel(t, {
    create: async () => {
      created++;
      return {
        prompt: async () => {
          controller.abort();
          throw new DOMException("The request is invalid", "NotSupportedError");
        },
        destroy: () => {},
      };
    },
  });
  assert.equal(
    await geminiGenerate({
      text: "Hello",
      signal: controller.signal,
      responseConstraint: { type: "object" },
    }),
    null,
  );
  assert.equal(created, 1);
});

test("a failed constraint retry returns the fallback error and frees both sessions", async (t) => {
  let created = 0;
  let destroyed = 0;
  mockLanguageModel(t, {
    create: async () => {
      const attempt = ++created;
      return {
        prompt: async () => {
          throw new DOMException(
            attempt === 1 ? "Invalid constraint" : "Plain prompt also failed",
            "NotSupportedError",
          );
        },
        destroy: () => {
          destroyed++;
        },
      };
    },
  });
  assert.deepEqual(
    await geminiGenerate({
      text: "Hello",
      signal: new AbortController().signal,
      responseConstraint: { type: "object" },
    }),
    { error: "NotSupportedError: Plain prompt also failed" },
  );
  assert.equal(created, 2);
  assert.equal(destroyed, 2);
});

test("aborting a pending prompt returns null and frees its session", async (t) => {
  const controller = new AbortController();
  let destroyed = false;
  mockLanguageModel(t, {
    create: async () => ({
      prompt: (_: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
          controller.abort(new Error("Replaced by a newer check"));
        }),
      destroy: () => {
        destroyed = true;
      },
    }),
  });
  assert.equal(
    await geminiGenerate({ text: "Hello", signal: controller.signal }),
    null,
  );
  assert.equal(destroyed, true);
});

test("a failed session creation returns its original error", async (t) => {
  mockLanguageModel(t, {
    create: async () => {
      throw new DOMException("Unable to create a session", "OperationError");
    },
  });
  assert.deepEqual(
    await geminiGenerate({
      text: "Hello",
      signal: new AbortController().signal,
    }),
    { error: "OperationError: Unable to create a session" },
  );
});

test("Chromium test backend output is reported instead of being parsed as a model answer", async (t) => {
  for (const constrained of [false, true]) {
    let destroyed = 0;
    mockLanguageModel(t, {
      create: async () => ({
        prompt: async (_: string, options: any) => {
          if (options.responseConstraint) {
            throw new DOMException(
              "The request is invalid",
              "NotSupportedError",
            );
          }
          return "CPU backend\nUser: Fix this sentence. End.";
        },
        destroy: () => {
          destroyed++;
        },
      }),
    });
    const result = await geminiGenerate({
      text: "Fix this sentence.",
      signal: new AbortController().signal,
      ...(constrained ? { responseConstraint: { type: "object" } } : {}),
    });
    assert.equal(typeof result, "object");
    assert.match(
      (result as { error: string }).error,
      /test responses.*Google Chrome.*Ollama/,
    );
    assert.equal(destroyed, constrained ? 2 : 1);
  }
});

test("session verification rejects the test backend but accepts a real model reply", async () => {
  const session = (response: string) =>
    ({ prompt: async () => response }) as unknown as LanguageModel;
  await assert.rejects(
    geminiVerify({
      session: session("CPU backend\nUser: Reply with only OK. End."),
    }),
    /test responses/,
  );
  await geminiVerify({ session: session("OK") });
});
