import { generateHOTP } from "./hotp";

/**
 * Generates a TOTP code according to RFC 6238.
 *
 * @param secretBase32 Base32 encoded secret key
 * @param timeSeconds Current unix time in seconds
 * @param period Time step period in seconds (normally 30)
 * @param algorithm HMAC algorithm: "SHA1", "SHA256", or "SHA512"
 * @param digits Number of digits (normally 6 or 8)
 */
export async function generateTOTP(
  secretBase32: string,
  timeSeconds: number,
  period: number = 30,
  algorithm: string = "SHA1",
  digits: number = 6
): Promise<string> {
  const counter = Math.floor(timeSeconds / period);
  return generateHOTP(secretBase32, counter, algorithm, digits);
}
