import React, { useState, useEffect } from "react";
import CreateVault from "./routes/CreateVault";
import Unlock from "./routes/Unlock";
import MainDashboard from "./routes/MainDashboard";
import AddAccount from "./routes/AddAccount";
import Import from "./routes/Import";
import Settings from "./routes/Settings";
import { getEncryptedVault } from "../storage/vaultRepository";
import { getSessionKey, getAutoLockMode } from "../storage/sessionRepository";
import { checkLockTimeout, updateActivity } from "../lock/lockManager";
import { decryptVault } from "../crypto/vaultCrypto";
import type { PlaintextVault, VaultEntry } from "../types/vault";
import "./styles.css";

type Screen = "loading" | "create_vault" | "unlock" | "dashboard" | "add_account" | "import" | "settings";

export default function Popup() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [unlockedVault, setUnlockedVault] = useState<PlaintextVault | null>(null);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [theme, setTheme] = useState("system");
  const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);

  // Initialize and check lock status
  useEffect(() => {
    async function init() {
      // 1. Establish background port connection for close-detection
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.connect) {
        try {
          chrome.runtime.connect({ name: "popup" });
        } catch (e) {
          // Ignore connection errors if background isn't ready
        }
      }

      // 2. Determine if vault exists in storage
      const vaultExists = await getEncryptedVault();
      if (!vaultExists) {
        setScreen("create_vault");
        applyTheme("system");
        return;
      }

      // 3. Check if we already have an active session
      const key = await getSessionKey();
      if (key) {
        const hasTimedOut = await checkLockTimeout();
        if (hasTimedOut) {
          setScreen("unlock");
          applyTheme("system"); // Fallback to system theme until decrypted
        } else {
          // Session is valid, attempt decryption
          try {
            const encryptedVault = await getEncryptedVault();
            if (encryptedVault) {
              const decrypted = await decryptVault(encryptedVault, key);
              const parsedVault: PlaintextVault = JSON.parse(decrypted);

              setSessionKey(key);
              setUnlockedVault(parsedVault);
              setScreen("dashboard");
              applyTheme(parsedVault.settings.theme || "system");
              await updateActivity(); // refresh activity timer
            } else {
              setScreen("unlock");
            }
          } catch (err) {
            console.warn("Session key decryption failed:", err);
            setScreen("unlock");
          }
        }
      } else {
        setScreen("unlock");
        applyTheme("system");
      }
    }

    init();
  }, []);

  // Theme application helper
  const applyTheme = (themeValue: string) => {
    setTheme(themeValue);
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");

    if (themeValue === "light") {
      root.classList.add("theme-light");
    } else if (themeValue === "dark") {
      root.classList.add("theme-dark");
    } else if (themeValue === "system") {
      // Detect system setting
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(isDark ? "theme-dark" : "theme-light");
    }
  };

  // User activity tracker wrapper
  const handleUserActivity = () => {
    if (sessionKey) {
      updateActivity().catch((err) => console.warn("Failed to reset idle activity timer:", err));
    }
  };

  const handleUnlockSuccess = (key: CryptoKey, vault: PlaintextVault) => {
    setSessionKey(key);
    setUnlockedVault(vault);
    setScreen("dashboard");
    applyTheme(vault.settings.theme || "system");
  };

  const handleLock = () => {
    setSessionKey(null);
    setUnlockedVault(null);
    setScreen("unlock");
    applyTheme("system"); // Reset theme to default system when locked
  };

  const handleReset = () => {
    setSessionKey(null);
    setUnlockedVault(null);
    setScreen("create_vault");
    applyTheme("system");
  };

  const handleNavigate = (targetScreen: string, extraData?: any) => {
    if (targetScreen === "add_account") {
      setEditEntry(extraData?.editEntry || null);
    }
    setScreen(targetScreen as Screen);
  };

  // Render proper screen
  const renderScreen = () => {
    switch (screen) {
      case "loading":
        return (
          <div className="auth-screen">
            <p>Loading Secure Vault...</p>
          </div>
        );
      case "create_vault":
        return <CreateVault onVaultCreated={handleUnlockSuccess} />;
      case "unlock":
        return <Unlock onUnlocked={handleUnlockSuccess} />;
      case "dashboard":
        if (!unlockedVault || !sessionKey) return null;
        return (
          <MainDashboard
            vault={unlockedVault}
            sessionKey={sessionKey}
            onLock={handleLock}
            onNavigate={handleNavigate}
            onUpdateVault={setUnlockedVault}
          />
        );
      case "add_account":
        if (!unlockedVault || !sessionKey) return null;
        return (
          <AddAccount
            vault={unlockedVault}
            sessionKey={sessionKey}
            editEntry={editEntry}
            onBack={() => setScreen("dashboard")}
            onUpdateVault={setUnlockedVault}
          />
        );
      case "import":
        if (!unlockedVault || !sessionKey) return null;
        return (
          <Import
            vault={unlockedVault}
            sessionKey={sessionKey}
            onBack={() => setScreen("dashboard")}
            onUpdateVault={setUnlockedVault}
          />
        );
      case "settings":
        if (!unlockedVault || !sessionKey) return null;
        return (
          <Settings
            vault={unlockedVault}
            sessionKey={sessionKey}
            onBack={() => setScreen("dashboard")}
            onUpdateVault={setUnlockedVault}
            onLock={handleLock}
            onReset={handleReset}
            currentTheme={theme}
            onChangeTheme={applyTheme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      onMouseMove={handleUserActivity}
      onKeyDown={handleUserActivity}
      onClick={handleUserActivity}
      onScroll={handleUserActivity}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {renderScreen()}
    </div>
  );
}
