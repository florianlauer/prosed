export const GEMINI_MODEL = "chrome:gemini-nano";
export const GEMINI_TEST_BACKEND_ERROR =
  "Gemini Nano is unavailable: this browser returns test responses. Use Google Chrome or choose an Ollama model.";

// Declare both languages so Chrome checks the same capabilities it will use for corrections.
export const geminiOptions: LanguageModelCreateCoreOptions = {
  expectedInputs: [{ type: "text", languages: ["en", "fr"] }],
  expectedOutputs: [{ type: "text", languages: ["en", "fr"] }],
};

export const geminiAvailability = async (): Promise<Availability> => {
  if (typeof LanguageModel === "undefined") return "unavailable";
  try {
    return await LanguageModel.availability(geminiOptions);
  } catch {
    return "unavailable";
  }
};

const modelResponse = (response: string) => {
  // Chromium's fake ChromeML backend emits this prefix before echoing the prompt.
  if (response.startsWith("CPU backend")) {
    throw new Error(GEMINI_TEST_BACKEND_ERROR);
  }
  return response;
};

export const geminiVerify = async ({ session }: { session: LanguageModel }) => {
  modelResponse(await session.prompt("Reply with only OK."));
};

export const geminiGenerate = async ({
  text,
  signal,
  ...options
}: LanguageModelPromptOptions & {
  text: LanguageModelPrompt;
  signal: AbortSignal;
}) => {
  let session: LanguageModel | undefined;
  try {
    session = await LanguageModel.create({ ...geminiOptions, signal });
    try {
      return modelResponse(await session.prompt(text, { ...options, signal }));
    } catch (error) {
      if (
        signal.aborted ||
        !(error instanceof DOMException) ||
        error.name !== "NotSupportedError" ||
        typeof text !== "string" ||
        !options.responseConstraint ||
        options.responseConstraint instanceof RegExp
      ) {
        throw error;
      }
      // Some browser backends accept prompts but reject constrained decoding.
      const { responseConstraint, ...fallbackOptions } = options;
      session.destroy();
      session = undefined;
      session = await LanguageModel.create({ ...geminiOptions, signal });
      return modelResponse(
        await session.prompt(
          `${text}\n\nReturn only valid JSON matching this schema, without markdown or explanations:\n${JSON.stringify(responseConstraint)}`,
          { ...fallbackOptions, signal },
        ),
      );
    }
  } catch (error) {
    if (signal.aborted) return null;
    return { error: String(error) };
  } finally {
    session?.destroy();
  }
};
