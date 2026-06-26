/**
 * Decodes an RFC 4648 compliant Base32 string to a Uint8Array.
 * Case-insensitive, ignores spaces, hyphens, and padding (=).
 */
export function decodeBase32(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/[\s-=]/g, "");
  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }
  
  if (!/^[A-Z2-7]*$/.test(cleaned)) {
    throw new Error("Invalid Base32 character");
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Encodes a Uint8Array into an RFC 4648 Base32 string.
 */
export function encodeBase32(data: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(value >> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return output;
}
