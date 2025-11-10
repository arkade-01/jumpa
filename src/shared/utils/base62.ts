/**
 * Base62 encoding utility for generating referral codes
 * Uses alphanumeric characters: 0-9, a-z, A-Z
 */

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Encodes a number to base62 string
 * @param num - Number to encode (e.g., telegram_id)
 * @returns Base62 encoded string
 */
export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_ALPHABET[0];

  let encoded = "";
  let value = num;

  while (value > 0) {
    const remainder = value % 62;
    encoded = BASE62_ALPHABET[remainder] + encoded;
    value = Math.floor(value / 62);
  }

  return encoded;
}

/**
 * Decodes a base62 string back to a number
 * @param str - Base62 encoded string
 * @returns Decoded number
 */
export function decodeBase62(str: string): number {
  let decoded = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE62_ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error(`Invalid base62 character: ${char}`);
    }

    decoded = decoded * 62 + value;
  }

  return decoded;
}
