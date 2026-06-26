/**
 * Converts a Uint8Array to a URL-safe Base64 (base64url) string.
 */
export function uint8ArrayToBase64url(arr: Uint8Array): string {
  const binary = Array.from(arr).map(b => String.fromCharCode(b)).join("");
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Converts a URL-safe Base64 (base64url) string to a Uint8Array.
 */
export function base64urlToUint8Array(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}
