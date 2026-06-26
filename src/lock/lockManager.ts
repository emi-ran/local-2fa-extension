import {
  getSessionKey,
  getLastActivityTime,
  getAutoLockMode,
  setLastActivityTime,
  setSessionKey,
  setAutoLockMode,
  clearSession,
} from "../storage/sessionRepository";

/**
 * Checks if the vault is currently locked (i.e. no key in session storage).
 */
export async function isLocked(): Promise<boolean> {
  const key = await getSessionKey();
  return !key;
}

/**
 * Locks the vault by clearing all session storage data.
 */
export async function lock(): Promise<void> {
  await clearSession();
}

/**
 * Unlocks the vault by saving the session key, auto lock configuration, and current time.
 */
export async function unlock(key: CryptoKey, autoLockMode: string): Promise<void> {
  await setSessionKey(key);
  await setAutoLockMode(autoLockMode);
  await setLastActivityTime(Date.now());
}

/**
 * Resets the inactivity timer by setting the last activity time to the current timestamp.
 */
export async function updateActivity(): Promise<void> {
  await setLastActivityTime(Date.now());
}

/**
 * Evaluates whether the lock timeout has expired based on the last activity time.
 * If expired, it locks the vault and returns true. Otherwise, returns false.
 */
export async function checkLockTimeout(): Promise<boolean> {
  const key = await getSessionKey();
  if (!key) {
    return true; // Already locked
  }

  const mode = await getAutoLockMode();
  if (!mode) {
    return false;
  }

  let timeoutMs = 0;
  switch (mode) {
    case "immediately":
      // "immediately" locks when the popup window is closed, not while open and active.
      return false;
    case "after_1_minute":
      timeoutMs = 60 * 1000;
      break;
    case "after_5_minutes":
      timeoutMs = 5 * 60 * 1000;
      break;
    case "after_15_minutes":
      timeoutMs = 15 * 60 * 1000;
      break;
    case "after_1_hour":
      timeoutMs = 60 * 60 * 1000;
      break;
    case "on_browser_close":
    case "manual_only":
      return false; // Standard session storage behavior (cleared on exit)
    default:
      timeoutMs = 5 * 60 * 1000;
  }

  const lastActivity = await getLastActivityTime();
  if (!lastActivity) {
    await updateActivity();
    return false;
  }

  if (Date.now() - lastActivity > timeoutMs) {
    await lock();
    return true; // Vault has locked
  }

  return false;
}
