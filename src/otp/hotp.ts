import { decodeBase32 } from "../crypto/base32";

/**
 * Generates an HOTP code according to RFC 4226.
 *
 * @param secretBase32 Base32 encoded secret key
 * @param counter 64-bit counter value
 * @param algorithm HMAC algorithm: "SHA1", "SHA256", or "SHA512"
 * @param digits Number of digits (normally 6 or 8)
 */
export async function generateHOTP(
  secretBase32: string,
  counter: number,
  algorithm: string = "SHA-1",
  digits: number = 6
): Promise<string> {
  const secretBytes = decodeBase32(secretBase32);

  // Map algorithm name to Web Crypto subtle format
  let hashName = "SHA-1";
  const normalizedAlg = algorithm.toUpperCase().replace(/[-_]/g, "");
  if (normalizedAlg === "SHA256") {
    hashName = "SHA-256";
  } else if (normalizedAlg === "SHA512") {
    hashName = "SHA-512";
  } else if (normalizedAlg === "SHA1") {
    hashName = "SHA-1";
  }

  // Import key for HMAC
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: { name: hashName },
    },
    false,
    ["sign"]
  );

  // Convert counter to an 8-byte big-endian array
  const counterBuffer = new Uint8Array(8);
  let temp = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  // Generate HMAC hash
  const hmacBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    counterBuffer
  );
  const hmac = new Uint8Array(hmacBuffer);

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = binary % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}
