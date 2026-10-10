export const cloudProviders = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    protocol: "openai",
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-6",
    protocol: "anthropic",
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/auto",
    protocol: "openai",
  },
  "gemini-api": {
    name: "Gemini API",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    protocol: "gemini",
  },
  mistral: {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    protocol: "openai",
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    protocol: "openai",
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    protocol: "openai",
  },
  custom: {
    name: "OpenAI compatible",
    baseUrl: "",
    model: "",
    protocol: "openai",
  },
} as const;

export type CloudProvider = keyof typeof cloudProviders;
export type CloudConfig = { model: string; baseUrl?: string };
export type CloudRequest = {
  provider: CloudProvider;
  url: string;
  body: Record<string, unknown>;
};

export const isCloudProvider = (provider: string): provider is CloudProvider =>
  Object.hasOwn(cloudProviders, provider);

export const requireCloudProvider = (provider: string): CloudProvider => {
  if (!isCloudProvider(provider)) throw new Error("Unknown API provider.");
  return provider;
};

export const cloudBaseUrl = ({
  provider,
  config,
}: {
  provider: string;
  config: CloudConfig;
}) => {
  const id = requireCloudProvider(provider);
  const value =
    id === "custom" ? config.baseUrl?.trim() : cloudProviders[id].baseUrl;
  if (!value) throw new Error("Enter an API base URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid API base URL.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use HTTPS, or HTTP on localhost, without credentials, a query or a fragment.",
    );
  }
  return url.href.replace(/\/+$/, "");
};

export const buildCloudRequest = ({
  provider,
  config,
  prompt,
  schema,
}: {
  provider: string;
  config: CloudConfig;
  prompt: string;
  schema: Record<string, unknown>;
}): CloudRequest => {
  const id = requireCloudProvider(provider);
  const model = config.model.trim();
  if (!model) throw new Error("Enter a model ID.");
  const base = cloudBaseUrl({ provider: id, config });
  // Prompted JSON works across compatible APIs that do not implement JSON schema mode.
  const instruction = `Return only a JSON object matching this schema. No markdown or explanation.\n${JSON.stringify(schema)}\n\n${prompt}`;
  const protocol = cloudProviders[id].protocol;
  if (protocol === "anthropic") {
    return {
      provider: id,
      url: `${base}/messages`,
      body: {
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: instruction }],
      },
    };
  }
  if (protocol === "gemini") {
    return {
      provider: id,
      url: `${base}/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`,
      body: {
        contents: [{ parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
    };
  }
  return {
    provider: id,
    url: `${base}/chat/completions`,
    body: {
      model,
      messages: [{ role: "user", content: instruction }],
      stream: false,
    },
  };
};

export const cloudHeaders = ({
  provider,
  apiKey,
}: {
  provider: string;
  apiKey: string;
}): Record<string, string> => {
  const id = requireCloudProvider(provider);
  if (!apiKey.trim())
    throw new Error("Add an API key for this provider in settings.");
  const protocol = cloudProviders[id].protocol;
  if (protocol === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }
  if (protocol === "gemini")
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey.trim(),
    };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey.trim()}`,
  };
};

export const cloudHttpError = (status: number) => {
  if (status === 401 || status === 403)
    return `API authentication failed (${status}). Check the key and its permissions.`;
  if (status === 429)
    return "API request limit or credit balance reached (429). Check your provider account.";
  return `The API request failed (${status}). Check the model ID and provider availability.`;
};

export const parseCloudResponse = ({
  provider,
  data,
}: {
  provider: string;
  data: unknown;
}): unknown => {
  const protocol = cloudProviders[requireCloudProvider(provider)].protocol;
  type Part = { type?: string; text?: string; thought?: boolean };
  const response = data as {
    content?: Part[];
    candidates?: { content?: { parts?: Part[] } }[];
    choices?: { message?: { content?: string } }[];
  } | null;
  const parts =
    protocol === "anthropic"
      ? response?.content
      : response?.candidates?.[0]?.content?.parts;
  const text: unknown =
    protocol === "openai"
      ? response?.choices?.[0]?.message?.content
      : Array.isArray(parts)
        ? parts
            .filter((part) =>
              protocol === "anthropic" ? part?.type === "text" : !part?.thought,
            )
            .map((part) => part?.text ?? "")
            .join("")
        : "";
  if (typeof text !== "string" || !text.trim())
    throw new Error(
      "The API returned an empty answer. Check the model and its output limits.",
    );
  const json = text
    .trim()
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1");
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(
      "The API returned invalid JSON. Choose a model that follows JSON instructions.",
    );
  }
};

export const cloudGenerate = async ({
  provider,
  config,
  apiKey,
  prompt,
  schema,
  signal,
  fetcher = fetch,
}: {
  provider: string;
  config: CloudConfig;
  apiKey: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<unknown> => {
  const request = buildCloudRequest({ provider, config, prompt, schema });
  const headers = cloudHeaders({ provider, apiKey });
  const deadline = AbortSignal.timeout(60_000);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let response: Response;
  try {
    cancellation.throwIfAborted();
    response = await fetcher(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request.body),
      signal: cancellation,
      redirect: "error",
      credentials: "omit",
    });
  } catch {
    if (signal?.aborted)
      throw new DOMException("The check was cancelled.", "AbortError");
    throw new Error(
      deadline.aborted
        ? "The API request timed out. Try again."
        : "Couldn't reach the API. Check your connection and API URL.",
    );
  }
  if (!response.ok) throw new Error(cloudHttpError(response.status));
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (signal?.aborted)
      throw new DOMException("The check was cancelled.", "AbortError");
    if (deadline.aborted)
      throw new Error("The API request timed out. Try again.");
    throw new Error("The API returned invalid JSON.");
  }
  return parseCloudResponse({ provider, data });
};

export const cloudTestPrompt =
  "Return a JSON object with correctedText set to Hello.";
export const cloudTestSchema = {
  type: "object",
  properties: { correctedText: { type: "string" } },
  required: ["correctedText"],
};

export const verifyCloudTest = (answer: unknown) => {
  if (
    !answer ||
    typeof answer !== "object" ||
    !("correctedText" in answer) ||
    typeof answer.correctedText !== "string"
  ) {
    throw new Error(
      "The model didn't return a grammar response. Choose another model.",
    );
  }
};
