import crypto from "crypto";
import { config } from "@core/config/config";  

const ENCRYPTION_KEY = config.encryptionKey;
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts a private key using 
 * @param privateKey - The private key to encrypt (hex string)
 * @returns Object containing encrypted data, iv, and tag
 */
export function encryptPrivateKey(privateKey: string): string {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher with IV
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv
    );

    // Encrypt the private key
    let encrypted = cipher.update(privateKey, "hex", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine iv, tag, and encrypted data
    const combined =
      iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;

    return combined;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt private key");
  }
}

/**
 * Decrypts a private key
 * @param encryptedData - The encrypted private key string
 * @returns Decrypted private key (hex string)
 */
export function decryptPrivateKey(encryptedData: string): string {
  try {
    // Split the combined data
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    // Create decipher with IV
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv
    );

    // Set the authentication tag
    decipher.setAuthTag(tag);

    // Decrypt the private key
    let decrypted = decipher.update(encrypted, "hex", "hex");
    decrypted += decipher.final("hex");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt private key");
  }
}

/**
 * Validates that encryption/decryption is working correctly
 * @returns boolean indicating if encryption is working
 */
export function testEncryption(): boolean {
  try {
    const testKey =
      "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const encrypted = encryptPrivateKey(testKey);
    const decrypted = decryptPrivateKey(encrypted);

    return testKey === decrypted;
  } catch (error) {
    console.error("Encryption test failed:", error);
    return false;
  }
}
