import { Keypair } from "@solana/web3.js";
import { encryptPrivateKey } from "./encryption";

interface SolanaWallet {
  telegram_id: string;
  address: string;
  private_key: string; // Raw private key for immediate use
  private_key_encrypted: string; // Encrypted version for storage
}

export default async function createNewSolanaWallet(
  telegramId: Number
): Promise<SolanaWallet> {
  try {
    if (!telegramId) {
      throw new Error("Valid telegram_id is required");
    }

    const solanaWallet = Keypair.generate();
    const privateKeyHex = Buffer.from(solanaWallet.secretKey).toString("hex");
    const encryptedPrivateKey = encryptPrivateKey(privateKeyHex);

    const newWallet: SolanaWallet = {
      telegram_id: telegramId.toString(),
      address: solanaWallet.publicKey.toString(),
      private_key: privateKeyHex, // Keep raw for immediate use (like showing to user)
      private_key_encrypted: encryptedPrivateKey, // Encrypted for database storage
    };

    console.log(
      `New Solana wallet created for Telegram ID ${telegramId}:`,
      newWallet.address
    );

    return newWallet;
  } catch (error) {
    console.error(
      `Failed to create wallet for Telegram ID ${telegramId}:`,
      error
    );
    throw new Error("Wallet creation failed");
  }
}
