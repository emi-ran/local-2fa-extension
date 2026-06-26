# Security Policy & Threat Model

This document outlines the security assumptions, protections, and boundaries of the Local 2FA Authenticator.

---

## 1. What the Extension Protects Against

- **Disk Theft / Extracted SQLite Files:** If an attacker gains physical or remote access to your computer's filesystem and extracts the Chrome extension storage files (usually stored as LevelDB or SQLite files), they cannot access your 2FA keys. The vault is encrypted with AES-GCM-256. They would have to brute-force the PBKDF2-SHA256 key (600,000 iterations), which is computationally infeasible for a strong master password.
- **Chrome Sync Extraction:** Even if your Chrome profile's local storage is synced or backed up, the secrets are useless without the master password.
- **In-Memory Vault Safety:** Plaintext credentials and OTP codes exist only inside the active JS context of the popup while it is open. Once closed, locked, or idle, the session is cleared from volatile storage (`chrome.storage.session`).

---

## 2. What the Extension CANNOT Protect Against

- **Active Malware on the Host System:** If your computer is infected with malware (e.g. keyloggers, screen scrapers, remote access trojans (RATs), or memory dumpers) that has administrative access or is running in your active user profile, the malware can capture your master password as you type it, screenshot the open popup, or read the keys directly from active memory. No software-based extension can protect against an infected host operating system.
- **Weak Master Passwords:** If you select a weak master password (e.g. `12345678`, `password`, or common dictionary words), an attacker who extracts your encrypted vault blob can easily perform a dictionary or brute-force attack to guess your password. Always choose a unique, high-entropy master password.
- **Phishing / Social Engineering:** If you paste your generated 2FA codes into a malicious site or reveal your master password to someone, the extension cannot prevent unauthorized access to your accounts.
- **Malicious Chrome Extensions:** If you install other untrusted extensions with broad host permissions or debugging privileges, they may inspect or interact with the Authenticator's popup window while it is open. Keep your extensions list minimal and trusted.
