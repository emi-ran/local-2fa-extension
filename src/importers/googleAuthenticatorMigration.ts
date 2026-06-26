import { parseMigrationPayload } from "./protobufReader";
import { parseOtpauthUri } from "../otp/otpauthUri";
import { encodeBase32 } from "../crypto/base32";
import { base64urlToUint8Array } from "../crypto/encoding";
import type { VaultEntry } from "../types/vault";

/**
 * Maps protobuf Algorithm enum to internal string representation.
 */
function mapAlgorithm(protoAlg?: number): string {
  switch (protoAlg) {
    case 1:
      return "SHA1";
    case 2:
      return "SHA256";
    case 3:
      return "SHA512";
    default:
      return "SHA1"; // Default fallback
  }
}

/**
 * Maps protobuf DigitCount enum to internal number.
 */
function mapDigits(protoDigits?: number): number {
  switch (protoDigits) {
    case 1:
      return 6;
    case 2:
      return 8;
    default:
      return 6; // Default fallback
  }
}

/**
 * Maps protobuf OtpType enum to internal string.
 */
function mapType(protoType?: number): "totp" | "hotp" {
  switch (protoType) {
    case 1:
      return "hotp";
    case 2:
      return "totp";
    default:
      return "totp";
  }
}

/**
 * Parses a text block containing one or more lines of otpauth:// or otpauth-migration:// URIs.
 * Returns a list of generated VaultEntry objects.
 */
export function parseMigrationText(text: string): VaultEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: VaultEntry[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    try {
      if (line.toLowerCase().startsWith("otpauth-migration:")) {
        const url = new URL(line);
        const rawData = url.searchParams.get("data");
        if (!rawData) continue;

        // URL decode followed by base64url decoding
        const decodedUri = decodeURIComponent(rawData);
        const payloadBytes = base64urlToUint8Array(decodedUri);

        // Parse Protobuf payload
        const payload = parseMigrationPayload(payloadBytes);

        for (const params of payload.otpParameters) {
          if (!params.secret || params.secret.length === 0) {
            continue; // Skip invalid accounts
          }

          const secretBase32 = encodeBase32(params.secret);
          const issuer = params.issuer || "";
          
          // Google Authenticator uses name to store the full "Issuer:AccountName" or just "AccountName"
          let name = params.name || "";
          let accountName = name;
          if (name.includes(":")) {
            const colonIndex = name.indexOf(":");
            accountName = name.substring(colonIndex + 1).trim();
          }

          const entryType = mapType(params.type);

          const entry: VaultEntry = {
            id: globalThis.crypto.randomUUID(),
            issuer: issuer.trim() || "Imported",
            accountName: accountName.trim() || "Unknown Account",
            secretBase32,
            algorithm: mapAlgorithm(params.algorithm),
            digits: mapDigits(params.digits),
            period: 30, // Default period for Google Authenticator is 30s
            type: entryType,
            counter: entryType === "hotp" ? Number(params.counter || 0n) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          entries.push(entry);
        }
      } else if (line.toLowerCase().startsWith("otpauth:")) {
        const parsed = parseOtpauthUri(line);
        const entry: VaultEntry = {
          id: globalThis.crypto.randomUUID(),
          issuer: parsed.issuer || "Imported",
          accountName: parsed.accountName || "Unknown Account",
          secretBase32: parsed.secretBase32,
          algorithm: parsed.algorithm,
          digits: parsed.digits,
          period: parsed.period,
          type: parsed.type,
          counter: parsed.counter,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        entries.push(entry);
      }
    } catch (err) {
      console.warn("Failed to parse migration line:", line, err);
      // Skip failed lines rather than crashing the whole process
    }
  }

  // Deduplicate entries by issuer + accountName + secretBase32
  const seen = new Set<string>();
  const uniqueEntries: VaultEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.issuer.toLowerCase()}:${entry.accountName.toLowerCase()}:${entry.secretBase32}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEntries.push(entry);
    }
  }

  return uniqueEntries;
}
