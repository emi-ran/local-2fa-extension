import { base64urlToUint8Array, uint8ArrayToBase64url } from "../crypto/encoding";

const KEY_SESSION_KEY = "session_key_raw";
const KEY_LAST_ACTIVITY = "session_last_activity";
const KEY_AUTO_LOCK_MODE = "session_auto_lock_mode";

/**
 * Checks if chrome.storage.session is available in the current environment.
 */
function isSessionStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.session;
}

/**
 * Exports a CryptoKey to raw format and stores it in session storage.
 */
export async function setSessionKey(key: CryptoKey): Promise<void> {
  if (!isSessionStorageAvailable()) return;
  const rawKey = await globalThis.crypto.subtle.exportKey("raw", key);
  const rawKeyBytes = new Uint8Array(rawKey);
  const base64urlKey = uint8ArrayToBase64url(rawKeyBytes);
  await chrome.storage.session.set({ [KEY_SESSION_KEY]: base64urlKey });
}

/**
 * Retrieves the raw key from session storage and imports it as a CryptoKey.
 */
export async function getSessionKey(): Promise<CryptoKey | null> {
  if (!isSessionStorageAvailable()) return null;
  const result = await chrome.storage.session.get(KEY_SESSION_KEY);
  const base64urlKey = result[KEY_SESSION_KEY];
  if (!base64urlKey) return null;

  try {
    const rawKeyBytes = base64urlToUint8Array(base64urlKey);
    return await globalThis.crypto.subtle.importKey(
      "raw",
      rawKeyBytes,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  } catch (err) {
    console.error("Failed to import session key:", err);
    return null;
  }
}

/**
 * Stores the last activity timestamp.
 */
export async function setLastActivityTime(time: number): Promise<void> {
  if (!isSessionStorageAvailable()) return;
  await chrome.storage.session.set({ [KEY_LAST_ACTIVITY]: time });
}

/**
 * Retrieves the last activity timestamp.
 */
export async function getLastActivityTime(): Promise<number | null> {
  if (!isSessionStorageAvailable()) return null;
  const result = await chrome.storage.session.get(KEY_LAST_ACTIVITY);
  const time = result[KEY_LAST_ACTIVITY];
  return typeof time === "number" ? time : null;
}

/**
 * Stores the auto lock mode.
 */
export async function setAutoLockMode(mode: string): Promise<void> {
  if (!isSessionStorageAvailable()) return;
  await chrome.storage.session.set({ [KEY_AUTO_LOCK_MODE]: mode });
}

/**
 * Retrieves the auto lock mode.
 */
export async function getAutoLockMode(): Promise<string | null> {
  if (!isSessionStorageAvailable()) return null;
  const result = await chrome.storage.session.get(KEY_AUTO_LOCK_MODE);
  return result[KEY_AUTO_LOCK_MODE] || null;
}

/**
 * Clears all session storage data (effective lock).
 */
export async function clearSession(): Promise<void> {
  if (!isSessionStorageAvailable()) return;
  await chrome.storage.session.clear();
}
