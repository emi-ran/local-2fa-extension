/**
 * Background Service Worker
 * 
 * Listens for popup connection events.
 * When the popup closes, if autoLockMode is set to "immediately",
 * it clears the session storage key to lock the extension.
 */

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onDisconnect.addListener(async () => {
      try {
        const result = await chrome.storage.session.get("session_auto_lock_mode");
        const mode = result.session_auto_lock_mode;
        
        if (mode === "immediately") {
          await chrome.storage.session.clear();
        }
      } catch (err) {
        console.error("Background auto-lock handler failed:", err);
      }
    });
  }
});
