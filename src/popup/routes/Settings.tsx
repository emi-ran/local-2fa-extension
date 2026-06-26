import React, { useState } from "react";
import { ArrowLeftIcon, AlertIcon, CheckIcon } from "../components/Icons";
import { encryptVault, decryptVault, deriveKey, generateRandomBytes } from "../../crypto/vaultCrypto";
import { getEncryptedVault, saveEncryptedVault, clearVault } from "../../storage/vaultRepository";
import { setAutoLockMode as saveSessionAutoLockMode, clearSession } from "../../storage/sessionRepository";
import { base64urlToUint8Array } from "../../crypto/encoding";
import type { PlaintextVault } from "../../types/vault";
import { unlock } from "../../lock/lockManager";

interface SettingsProps {
  vault: PlaintextVault;
  sessionKey: CryptoKey;
  onBack: () => void;
  onUpdateVault: (vault: PlaintextVault) => void;
  onLock: () => void;
  onReset: () => void;
  currentTheme: string;
  onChangeTheme: (theme: string) => void;
}

export default function Settings({
  vault,
  sessionKey,
  onBack,
  onUpdateVault,
  onLock,
  onReset,
  currentTheme,
  onChangeTheme,
}: SettingsProps) {
  const [autoLockMode, setAutoLockMode] = useState(vault.settings.autoLockMode);
  
  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Plaintext export states
  const [plaintextRevealOpen, setPlaintextRevealOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [plaintextList, setPlaintextList] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");

  // Factory reset states
  const [resetRevealOpen, setResetRevealOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // General error/success states
  const [generalError, setGeneralError] = useState("");
  const [generalSuccess, setGeneralSuccess] = useState("");

  const handleAutoLockChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value;
    setAutoLockMode(newMode);
    setGeneralError("");
    setGeneralSuccess("");

    const updatedVault: PlaintextVault = {
      ...vault,
      settings: {
        ...vault.settings,
        autoLockMode: newMode,
      },
    };

    try {
      const encryptedVault = await getEncryptedVault();
      if (encryptedVault) {
        const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
        const encrypted = await encryptVault(
          JSON.stringify(updatedVault),
          sessionKey,
          salt,
          encryptedVault.kdf.iterations
        );
        await saveEncryptedVault(encrypted);
        await saveSessionAutoLockMode(newMode);
        onUpdateVault(updatedVault);
        setGeneralSuccess("Auto-lock settings updated.");
      }
    } catch (err) {
      setGeneralError("Failed to update auto-lock settings.");
    }
  };

  const handleThemeChange = async (theme: string) => {
    setGeneralError("");
    setGeneralSuccess("");

    const updatedVault: PlaintextVault = {
      ...vault,
      settings: {
        ...vault.settings,
        theme,
      },
    };

    try {
      const encryptedVault = await getEncryptedVault();
      if (encryptedVault) {
        const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
        const encrypted = await encryptVault(
          JSON.stringify(updatedVault),
          sessionKey,
          salt,
          encryptedVault.kdf.iterations
        );
        await saveEncryptedVault(encrypted);
        onChangeTheme(theme);
        onUpdateVault(updatedVault);
        setGeneralSuccess("Theme settings updated.");
      }
    } catch (err) {
      setGeneralError("Failed to update theme.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      const encryptedVault = await getEncryptedVault();
      if (!encryptedVault) {
        setPasswordError("Vault error. Please reload extension.");
        return;
      }

      // Verify old password by deriving key and attempting to decrypt
      const oldSalt = base64urlToUint8Array(encryptedVault.kdf.salt);
      const testKey = await deriveKey(oldPassword, oldSalt, encryptedVault.kdf.iterations);

      try {
        await decryptVault(encryptedVault, testKey);
      } catch (err) {
        setPasswordError("Incorrect old password.");
        return;
      }

      // Generate new salt and new key
      const newSalt = generateRandomBytes(16);
      const newKey = await deriveKey(newPassword, newSalt);

      // Re-encrypt the vault plaintext with new key/salt
      const newEncrypted = await encryptVault(JSON.stringify(vault), newKey, newSalt);

      await saveEncryptedVault(newEncrypted);
      await unlock(newKey, autoLockMode); // update session key
      
      // Clear inputs
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Master password changed successfully!");
    } catch (err) {
      setPasswordError("Cryptographic error occurred.");
    }
  };

  const handleExportBackup = async () => {
    try {
      const encryptedVault = await getEncryptedVault();
      if (!encryptedVault) {
        setGeneralError("No vault found to backup.");
        return;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(encryptedVault, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "authenticator_encrypted_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      setGeneralSuccess("Encrypted backup downloaded.");
    } catch (err) {
      setGeneralError("Failed to export backup.");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setGeneralError("");
    setGeneralSuccess("");
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Simple validation of encrypted vault shape
        if (!parsed.version || !parsed.kdf || !parsed.cipher) {
          setGeneralError("Invalid backup file format. Must contain version, kdf, and cipher details.");
          return;
        }

        // Save imported encrypted vault over current vault
        await saveEncryptedVault(parsed);
        
        // Immediately lock vault so they must login using the backup's master password
        setGeneralSuccess("Backup imported successfully! Locking vault in 3 seconds...");
        setTimeout(async () => {
          await clearSession();
          onLock();
        }, 3000);
      } catch (err) {
        setGeneralError("Failed to parse backup JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleRevealPlaintext = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError("");
    setPlaintextList(null);

    try {
      const encryptedVault = await getEncryptedVault();
      if (!encryptedVault) return;

      const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
      const testKey = await deriveKey(exportPassword, salt, encryptedVault.kdf.iterations);

      try {
        await decryptVault(encryptedVault, testKey);
      } catch (err) {
        setExportError("Incorrect password.");
        return;
      }

      // Generate standard URIs for all accounts
      const uris = vault.entries.map((entry) => {
        const label = `${encodeURIComponent(entry.issuer)}:${encodeURIComponent(entry.accountName)}`;
        let uri = `otpauth://${entry.type}/${label}?secret=${entry.secretBase32}&issuer=${encodeURIComponent(
          entry.issuer
        )}&algorithm=${entry.algorithm}&digits=${entry.digits}&period=${entry.period}`;
        if (entry.type === "hotp") {
          uri += `&counter=${entry.counter || 0}`;
        }
        return uri;
      });

      setPlaintextList(uris.join("\n"));
      setExportPassword("");
    } catch (err) {
      setExportError("Failed to decrypt vault.");
    }
  };

  const handleFactoryReset = async () => {
    if (resetConfirmText === "DELETE VAULT") {
      await clearVault();
      await clearSession();
      onReset();
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-group">
          <button onClick={onBack} className="btn-icon" title="Back">
            <ArrowLeftIcon size={16} />
          </button>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="scrollable-content flex flex-column gap-8">
        {/* General Alert */}
        {generalError && <div className="error-alert mb-4">{generalError}</div>}
        {generalSuccess && <div className="success-alert mb-4">{generalSuccess}</div>}

        {/* Lock Settings */}
        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Auto-Lock Behavior</label>
          <select className="form-select w-100" value={autoLockMode} onChange={handleAutoLockChange} style={{ width: "100%" }}>
            <option value="immediately">Lock when popup closes</option>
            <option value="after_1_minute">Lock after 1 minute idle</option>
            <option value="after_5_minutes">Lock after 5 minutes idle</option>
            <option value="after_15_minutes">Lock after 15 minutes idle</option>
            <option value="after_1_hour">Lock after 1 hour idle</option>
            <option value="on_browser_close">Lock only on browser close</option>
            <option value="manual_only">Manual lock only</option>
          </select>
        </div>

        {/* Theme Select */}
        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Display Theme</label>
          <div className="theme-selector-group">
            <button
              onClick={() => handleThemeChange("light")}
              className={`theme-btn ${currentTheme === "light" ? "active" : ""}`}
            >
              Light
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`theme-btn ${currentTheme === "dark" ? "active" : ""}`}
            >
              Dark
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`theme-btn ${currentTheme === "system" ? "active" : ""}`}
            >
              System
            </button>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />

        {/* Change Password */}
        <div className="flex flex-column text-left">
          <h4>Change Master Password</h4>
          <form onSubmit={handlePasswordChange} className="flex flex-column gap-8 mt-4 text-left">
            <div className="form-group" style={{ textAlign: "left" }}>
              <input
                type="password"
                className="form-input"
                placeholder="Current Master Password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ textAlign: "left" }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="New Password (Min 8)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ textAlign: "left" }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Confirm New"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {passwordError && <div className="error-alert">{passwordError}</div>}
            {passwordSuccess && <div className="success-alert">{passwordSuccess}</div>}
            <button type="submit" className="btn btn-secondary w-100 mt-2" style={{ width: "100%" }}>
              Update Password
            </button>
          </form>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />

        {/* Backup & Restore */}
        <div className="flex flex-column text-left">
          <h4>Backup & Restore</h4>
          <div className="flex flex-column gap-8 mt-4">
            <button onClick={handleExportBackup} className="btn btn-secondary w-100" style={{ width: "100%" }}>
              Export Encrypted Backup (JSON)
            </button>
            <div style={{ position: "relative" }}>
              <button className="btn btn-secondary w-100" style={{ width: "100%", pointerEvents: "none" }}>
                Import Encrypted Backup
              </button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />

        {/* Dangerous Plaintext Export */}
        <div className="flex flex-column text-left">
          <h4 style={{ color: "var(--danger)" }}>Dangerous Actions</h4>
          <div className="flex flex-column gap-8 mt-4">
            {!plaintextRevealOpen ? (
              <button
                onClick={() => setPlaintextRevealOpen(true)}
                className="btn btn-secondary w-100"
                style={{ color: "var(--danger)", borderColor: "var(--danger)", width: "100%" }}
              >
                Export Plaintext accounts
              </button>
            ) : (
              <form onSubmit={handleRevealPlaintext} className="flex flex-column gap-8 text-left" style={{ border: "1px solid var(--danger)", padding: "10px", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: "11px", color: "var(--danger)", fontWeight: "bold" }}>
                  WARNING: This will reveal your OTP secrets in plaintext! Make sure nobody is watching.
                </div>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Verify Master Password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  required
                />
                {exportError && <div className="error-alert">{exportError}</div>}
                <div className="flex gap-8">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaintextRevealOpen(false);
                      setPlaintextList(null);
                      setExportError("");
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger flex-1">
                    Reveal Plaintext URIs
                  </button>
                </div>

                {plaintextList && (
                  <div className="mt-4 flex flex-column gap-8">
                    <textarea
                      className="form-input"
                      rows={5}
                      readOnly
                      value={plaintextList}
                      style={{ fontSize: "10px", fontFamily: "monospace", resize: "none" }}
                      onClick={(e) => (e.target as any).select()}
                    />
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                      Click inside to select all, then copy them safely. Close when done.
                    </div>
                  </div>
                )}
              </form>
            )}

            {!resetRevealOpen ? (
              <button
                onClick={() => setResetRevealOpen(true)}
                className="btn btn-danger w-100"
                style={{ width: "100%" }}
              >
                Reset Vault / Delete All Data
              </button>
            ) : (
              <div className="flex flex-column gap-8 text-left" style={{ border: "1px solid var(--danger)", padding: "10px", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: "11px", color: "var(--danger)", fontWeight: "bold" }}>
                  WARNING: This will completely erase all local 2FA tokens and settings.
                  To proceed, type <strong>DELETE VAULT</strong> below:
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="DELETE VAULT"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                />
                <div className="flex gap-8">
                  <button
                    onClick={() => {
                      setResetRevealOpen(false);
                      setResetConfirmText("");
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleFactoryReset} 
                    className="btn btn-danger flex-1"
                    disabled={resetConfirmText !== "DELETE VAULT"}
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
