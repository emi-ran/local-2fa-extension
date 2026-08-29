export interface ParsedOtpauthUri {
  type: "totp" | "hotp";
  issuer: string;
  accountName: string;
  secretBase32: string;
  algorithm: string;
  digits: number;
  period: number;
  counter: number | null;
}

/**
 * Builds a standard otpauth:// URI for export/QR code sharing.
 * Fully compatible with Google Authenticator, Microsoft Authenticator, Authy, Apple Passwords, etc.
 *
 * Example: otpauth://totp/GitHub:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
 */
export function buildOtpauthUri(entry: {
  type?: string;
  issuer?: string;
  accountName?: string;
  secretBase32: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  counter?: number | null;
}): string {
  const type = (entry.type || "totp").toLowerCase();
  const issuer = (entry.issuer || "").trim();
  const accountName = (entry.accountName || "").trim();

  let label = "";
  if (issuer && accountName) {
    label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  } else if (issuer) {
    label = encodeURIComponent(issuer);
  } else if (accountName) {
    label = encodeURIComponent(accountName);
  } else {
    label = "Account";
  }

  const cleanSecret = entry.secretBase32.replace(/\s+/g, "").toUpperCase();
  const params = new URLSearchParams();
  params.set("secret", cleanSecret);

  if (issuer) {
    params.set("issuer", issuer);
  }

  const algorithm = (entry.algorithm || "SHA1").toUpperCase();
  if (algorithm && algorithm !== "SHA1") {
    params.set("algorithm", algorithm);
  }

  const digits = entry.digits || 6;
  if (digits && digits !== 6) {
    params.set("digits", digits.toString());
  }

  if (type === "totp") {
    const period = entry.period || 30;
    if (period && period !== 30) {
      params.set("period", period.toString());
    }
  } else if (type === "hotp") {
    const counter = entry.counter ?? 0;
    params.set("counter", counter.toString());
  }

  return `otpauth://${type}/${label}?${params.toString()}`;
}

/**
 * Parses a standard otpauth:// URI.
 * Example: otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
 */
export function parseOtpauthUri(uri: string): ParsedOtpauthUri {
  const url = new URL(uri);
  if (url.protocol.toLowerCase() !== "otpauth:") {
    throw new Error("Invalid protocol: Must start with otpauth://");
  }

  const type = url.hostname.toLowerCase();
  if (type !== "totp" && type !== "hotp") {
    throw new Error("Unsupported OTP type: Must be totp or hotp");
  }

  // Pathname begins with a slash, strip it to get the label
  const label = decodeURIComponent(url.pathname.substring(1));
  let issuer = url.searchParams.get("issuer") || "";
  let accountName = label;

  // The label can be formatted as "Issuer:AccountName" or just "AccountName"
  if (label.includes(":")) {
    const colonIndex = label.indexOf(":");
    const pathIssuer = label.substring(0, colonIndex).trim();
    const pathAccount = label.substring(colonIndex + 1).trim();
    if (!issuer) {
      issuer = pathIssuer;
    }
    accountName = pathAccount;
  }

  const secret = url.searchParams.get("secret") || "";
  if (!secret) {
    throw new Error("Missing secret parameter");
  }

  const algorithm = (url.searchParams.get("algorithm") || "SHA1").toUpperCase();
  const digits = parseInt(url.searchParams.get("digits") || "6", 10);
  const period = parseInt(url.searchParams.get("period") || "30", 10);
  
  let counter: number | null = null;
  const counterParam = url.searchParams.get("counter");
  if (type === "hotp") {
    counter = counterParam ? parseInt(counterParam, 10) : 0;
  }

  return {
    type: type as "totp" | "hotp",
    issuer: issuer.trim(),
    accountName: accountName.trim(),
    secretBase32: secret.replace(/\s+/g, "").toUpperCase(),
    algorithm,
    digits: isNaN(digits) ? 6 : digits,
    period: isNaN(period) ? 30 : period,
    counter: (counter !== null && isNaN(counter)) ? 0 : counter,
  };
}
