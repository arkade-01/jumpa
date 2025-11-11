import { Context } from "telegraf";
import getUser, { addSolanaWalletToUser, addEVMWalletToUser } from "@modules/users/getUserInfo";
import { Markup } from "telegraf";
import { encryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import { setUserActionState, clearUserActionState } from "@shared/state/userActionState";
import bs58 from "bs58";

export class AddWalletHandlers {
  // Handle add wallet callback
  static async handleAddWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("➕ Add Wallet");

      const message = `➕ **Add Wallet**

Choose the wallet type you want to add. Choose EVM if you want to import a wallet on Base, Celo, Lisk or any other EVM chain.`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🟣 Import Solana", "add_wallet_solana"),
          Markup.button.callback("🔵 Import EVM", "add_wallet_evm"),
        ],
        [
          Markup.button.callback("🔵 Generate EVM Wallet", "generate_evm_wallet"),
        ], [
          Markup.button.callback("🔙 Back", "view_wallet"),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Add wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to show wallet options.");
      await ctx.reply("❌ An error occurred. Please try again.");
    }
  }

  // Handle add Solana wallet callback
  static async handleAddSolanaWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🟣 Add Solana Wallet");

      // Get user to check if wallet already exists
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register first.");
        return;
      }

      // Check wallet limit
      if (user.solanaWallets.length >= 3) {
        await ctx.reply("❌ You have reached the maximum limit of 3 Solana wallets.");
        return;
      }

      // Set state to await private key
      setUserActionState(telegramId, {
        action: "awaiting_add_solana_private_key",
      });

      const importMessage = `📥 **Add Solana Wallet**

Paste your Solana private key (base58 or hex format).

⚠️ **Note:**
- Your private key will be stored securely.
- Never share your private key with anyone
- This wallet will be added to your existing wallets

Use /cancel to cancel this operation.`;

      await ctx.reply(importMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Add Solana wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to start add wallet process.");
      await ctx.reply("❌ An error occurred. Please try again.");
    }
  }

  // Handle add EVM wallet callback
  static async handleAddEVMWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔵 Add EVM Wallet");

      // Get user to check if wallet already exists
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register first.");
        return;
      }

      // Check wallet limit
      if (user.evmWallets.length >= 3) {
        await ctx.reply("❌ You have reached the maximum limit of 3 EVM wallets.");
        return;
      }

      // Set state to await private key
      setUserActionState(telegramId, {
        action: "awaiting_add_evm_private_key",
      });

      const importMessage = `📥 **Add EVM Wallet**

Paste your EVM private key (hex format, with or without 0x prefix).

⚠️ **Note:**
- Your private key will be stored securely.
- Never share your private key with anyone
- This wallet will be added to your existing wallets
- Works with Base, Celo, Lisk, and any other EVM-compatible chains

Use /cancel to cancel this operation.`;

      await ctx.reply(importMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Add EVM wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to start add wallet process.");
      await ctx.reply("❌ An error occurred. Please try again.");
    }
  }

  // Handle add EVM private key input
  static async handleAddEVMPrivateKeyInput(
    ctx: Context,
    privateKeyInput: string
  ): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply("❌ Unable to identify your account.");
      return;
    }

    try {
      // Clear the state
      clearUserActionState(telegramId);

      // Clean the input (remove whitespace and 0x prefix if present)
      let privateKeyInputClean = privateKeyInput.trim();

      // Remove 0x prefix if present
      if (privateKeyInputClean.startsWith("0x") || privateKeyInputClean.startsWith("0X")) {
        privateKeyInputClean = privateKeyInputClean.slice(2);
      }

      // Validate private key format (should be 64 hex characters = 32 bytes)
      if (!/^[0-9a-fA-F]{64}$/.test(privateKeyInputClean)) {
        await ctx.reply(
          "❌ Invalid private key format. Please provide a valid 64-character hexadecimal private key (with or without 0x prefix)."
        );
        return;
      }

      // Validate and create wallet from private key using ethers.js v6
      let wallet: Wallet;
      try {
        // Add 0x prefix for ethers.js
        const privateKeyWithPrefix = "0x" + privateKeyInputClean;
        wallet = new Wallet(privateKeyWithPrefix);
      } catch (error) {
        await ctx.reply(
          "❌ Invalid private key. Please check and try again."
        );
        return;
      }

      const walletAddress = wallet.address;

      // Check if wallet already exists in user's wallets
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );
      if (!user) {
        await ctx.reply("❌ User not found.");
        return;
      }

      const existingWallet = user.evmWallets.find(
        (wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (existingWallet) {
        await ctx.reply("⚠️ This wallet is already added to your account.");
        return;
      }

      // Encrypt private key (ethers private keys are already hex format)
      const encryptedPrivateKey = encryptPrivateKey(privateKeyInputClean);

      // Add wallet to user
      await addEVMWalletToUser(
        telegramId,
        walletAddress,
        encryptedPrivateKey
      );

      const successMessage = `✅ **EVM Wallet Added Successfully!**

📍 **Wallet Address:**
\`${walletAddress}\`

Your EVM wallet has been added to your account!

This wallet works on all EVM-compatible chains:
• Ethereum
• Base
• Celo
• Lisk
• Polygon
• And more...`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
      ]);

      await ctx.reply(successMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Add EVM private key error:", error);
      clearUserActionState(telegramId);

      // Handle specific error cases
      if (error instanceof Error && error.message === "Wallet already exists") {
        await ctx.reply("⚠️ This wallet is already added to your account.");
      } else {
        await ctx.reply(
          "❌ An error occurred while adding your wallet. Please try again."
        );
      }
    }
  }

  // Handle add Solana private key input
  static async handleAddSolanaPrivateKeyInput(
    ctx: Context,
    privateKeyInput: string
  ): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply("❌ Unable to identify your account.");
      return;
    }

    try {
      // Clear the state
      clearUserActionState(telegramId);

      // Clean the input (remove whitespace)
      const privateKeyInputClean = privateKeyInput.trim();

      // Decode private key and validate - support both base58 and hex formats
      let secretKey: Uint8Array;
      try {
        // Try base58 format first
        if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(privateKeyInputClean)) {
          // Looks like base58 format
          secretKey = bs58.decode(privateKeyInputClean);
        } else if (/^[0-9a-fA-F]+$/.test(privateKeyInputClean)) {
          // Looks like hex format
          const buffer = Buffer.from(privateKeyInputClean, "hex");
          secretKey = new Uint8Array(buffer);
        } else {
          throw new Error("Invalid format. Expected base58 or hexadecimal string.");
        }

        // Solana private keys can be:
        // - 64 bytes (full secret key: 32-byte private key + 32-byte public key)
        // - 32 bytes (just the private key, public key will be derived)
        if (secretKey.length !== 64 && secretKey.length !== 32) {
          throw new Error(
            `Invalid private key length. Expected 32 or 64 bytes, got ${secretKey.length}.`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await ctx.reply(
          `❌ Invalid private key format. ${errorMessage} Please provide a valid base58 or hex encoded private key.`
        );
        return;
      }

      // Validate and create keypair from private key
      let keypair: Keypair;
      try {
        // Keypair.fromSecretKey accepts both 32-byte (private key only) and 64-byte (secret key) formats
        keypair = Keypair.fromSecretKey(secretKey);
      } catch (error) {
        await ctx.reply(
          "❌ Invalid private key. Please check and try again."
        );
        return;
      }

      const walletAddress = keypair.publicKey.toString();

      // Check if wallet already exists in user's wallets
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );
      if (!user) {
        await ctx.reply("❌ User not found.");
        return;
      }

      const existingWallet = user.solanaWallets.find(
        (wallet) => wallet.address === walletAddress
      );
      if (existingWallet) {
        await ctx.reply("⚠️ This wallet is already added to your account.");
        return;
      }

      // Convert secret key to hex for encryption (encryption function expects hex)
      const privateKeyHex = Buffer.from(secretKey).toString("hex");

      // Encrypt private key
      const encryptedPrivateKey = encryptPrivateKey(privateKeyHex);

      // Add wallet to user
      await addSolanaWalletToUser(
        telegramId,
        walletAddress,
        encryptedPrivateKey
      );

      const successMessage = `✅ **Wallet Added Successfully!**

📍 **Wallet Address:**
\`${walletAddress}\`

Your wallet has been added to your account!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Wallets", "view_wallet")],
      ]);

      await ctx.reply(successMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Add Solana private key error:", error);
      clearUserActionState(telegramId);

      // Handle specific error cases
      if (error instanceof Error && error.message === "Wallet already exists") {
        await ctx.reply("⚠️ This wallet is already added to your account.");
      } else {
        await ctx.reply(
          "❌ An error occurred while adding your wallet. Please try again."
        );
      }
    }
  }

  static async handleGenerateEVMWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔵 Generating New EVM Wallet...");

      // Get user to check if wallet already exists
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );

      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register first.");
        return;
      }

      // Check wallet limit
      if (user.evmWallets.length >= 3) {
        await ctx.reply("❌ You have reached the maximum limit of 3 EVM wallets.");
        return;
      }

      // Try generating a new wallet
      const newWallet = createRandomEvmWallet();

      if (newWallet && newWallet.success) {
        // Encrypt and save
        console.log("new wallet", newWallet)

        // Remove 0x prefix if present (ethers.js always returns private keys with 0x prefix)
        const pKeyWithout0x = newWallet.newPrivateKey.startsWith("0x")
          ? newWallet.newPrivateKey.slice(2)
          : newWallet.newPrivateKey;

        const encryptedPrivateKey = encryptPrivateKey(pKeyWithout0x);
        console.log("encrypted pkey: ", encryptedPrivateKey)
        await addEVMWalletToUser(
          telegramId,
          newWallet.newAddress,
          encryptedPrivateKey
        );

        const replyMessage = `📥 **Generate New EVM Wallet**
  
  A new wallet has been generated for you and can be used for trade and P2P transactions.
  
  **Address:** \`${newWallet.newAddress}\`
  `;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back", "view_wallet")],
        ]);

        await ctx.reply(replyMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      } else {
        // Wallet generation failed
        await ctx.reply("❌ Failed to generate a new EVM wallet. Please try again later.");
      }
    } catch (error) {
      console.error("Wallet generation error:", error);
      await ctx.reply("⚠️ An unexpected error occurred while generating your wallet. Please try again.");
    }
  }
}
//function to generate the wallet
const createRandomEvmWallet = () => {
  try {
    const wallet = Wallet.createRandom(); // generate random wallet
    console.log("wallet", wallet);
    console.log("address:", wallet.address);
    console.log("privateKey:", wallet.privateKey);
    // console.log("mnemonic:", wallet.mnemonic?.phrase); // the 12/24-word phrase (if available)

    const newAddress = wallet.address;
    const newPrivateKey = wallet.privateKey;
    return { success: true, newAddress, newPrivateKey }

  } catch (error) {
    console.log("failed to generate wallet", error)
    return { success: false }
  }
}
