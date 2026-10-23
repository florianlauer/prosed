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
  chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });

// Firefox content scripts share storage.local, but cannot open the extension origin's IndexedDB.
const privateKey = ({
  mode,
  operation,
}: {
  mode: IDBTransactionMode;
  operation: (store: IDBObjectStore) => IDBRequest;
}): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const opening = indexedDB.open("prosed-credentials", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("keys");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      try {
        const transaction = db.transaction("keys", mode);
        const request = operation(transaction.objectStore("keys"));
        transaction.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("Credential storage failed."));
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });

export const getCloudKey = async (provider: string): Promise<string> => {
  const name = keyName(provider);
  if (!chrome.storage.local.setAccessLevel) {
    const key = await privateKey({
      mode: "readonly",
      operation: (store) => store.get(name),
    });
    return typeof key === "string" ? key : "";
  }
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
  if (!chrome.storage.local.setAccessLevel) {
    await privateKey({
      mode: "readwrite",
      operation: (store) => store.put(key, name),
    });
    return;
  }
  await protectCloudKeys();
  await chrome.storage.local.set({ [name]: key });
};

export const removeCloudKey = async (provider: string) => {
  const name = keyName(provider);
  if (!chrome.storage.local.setAccessLevel) {
    await privateKey({
      mode: "readwrite",
      operation: (store) => store.delete(name),
    });
    return;
  }
  await protectCloudKeys();
  await chrome.storage.local.remove(name);
};
