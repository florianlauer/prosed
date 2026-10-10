import { requireCloudProvider } from "./cloud.ts";

export const requireCloudSettingsSender = (
  sender: chrome.runtime.MessageSender,
) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL("src/options/index.html")
  ) {
    throw new Error("Open the extension settings to manage API keys.");
  }
};

const keyName = (provider: string) => `byok:${requireCloudProvider(provider)}`;

// Content scripts must never read keys, even when they share the extension's storage API.
export const protectCloudKeys = () =>
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

export const getCloudKey = async (provider: string): Promise<string> => {
  const name = keyName(provider);
  await protectCloudKeys();
  const stored = await chrome.storage.local.get(name);
  return typeof stored[name] === "string" ? stored[name] : "";
};

export const cloudKeyStatus = async (provider: string) =>
  Boolean(await getCloudKey(provider));

export const saveCloudKey = async ({
  provider,
  apiKey,
}: {
  provider: string;
  apiKey: string;
}) => {
  const name = keyName(provider);
  const key = apiKey.trim();
  if (!key || /[\r\n]/.test(key)) throw new Error("Enter a valid API key.");
  await protectCloudKeys();
  await chrome.storage.local.set({ [name]: key });
};

export const removeCloudKey = async (provider: string) => {
  const name = keyName(provider);
  await protectCloudKeys();
  await chrome.storage.local.remove(name);
};
