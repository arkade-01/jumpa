import { Context } from "telegraf";
import getUser, { addSolanaWalletToUser, addEVMWalletToUser } from "@modules/users/getUserInfo";
import { AjoCallbackHandlers } from "@modules/ajo-groups/callbacks/AjoCallbackHandlers";
import { Markup } from "telegraf";
import createNewSolanaWallet from "@shared/utils/createWallet";
import { encryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";
import { setUserActionState, clearUserActionState } from "@shared/state/userActionState";
import bs58 from "bs58";

export class StartCallbackHandlers {
  // Handle view wallet callback
  static async handleViewWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔑 Loading wallets...");

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      const solanaWallets = user.solanaWallets || [];
      const evmWallets = user.evmWallets || [];
      const totalWallets = solanaWallets.length + evmWallets.length;

      if (totalWallets === 0) {
        const noWalletMessage = `<b>🔑 Your Wallets</b>

You don't have any wallets yet.

Set up a wallet to start trading!`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("🔑 Generate New Solana Wallet", "generate_wallet"),
          ],
          [
            Markup.button.callback("📥 Import Existing Solana Wallet", "import_wallet"),
          ],
          [
            Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
          ],
        ]);

        await ctx.reply(noWalletMessage, {
          parse_mode: "HTML",
          ...keyboard,
        });
        return;
      }

      // Build wallet list message
      let walletMessage = `<b>Your Wallets</b>\n\n`;

      // Display Solana wallets
      if (solanaWallets.length > 0) {
        walletMessage += `<b>🟣 Solana Wallets (${solanaWallets.length})</b>\n`;
        solanaWallets.forEach((wallet, index) => {
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>\n`;
          walletMessage += `   Balance: ${balance} SOL\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        });
        walletMessage += `\n`;
      }

      // Display EVM wallets
      if (evmWallets.length > 0) {
        walletMessage += `<b>🔵 EVM Wallets (${evmWallets.length})</b>\n`;
        evmWallets.forEach((wallet, index) => {
          const balance = wallet.balance?.toFixed(4) || "0.0000";
          const lastUpdated = wallet.last_updated_balance
            ? new Date(wallet.last_updated_balance).toLocaleDateString()
            : "Never";
          walletMessage += `\n<b>${index + 1}.</b> <code>${wallet.address}</code>\n`;
          walletMessage += `   Balance: ${balance} ETH\n`;
          walletMessage += `   Updated: ${lastUpdated}\n`;
        });
        walletMessage += `\n`;
      }

      // Add summary
      let totalSolBalance = 0;
      for (const wallet of solanaWallets) {
        totalSolBalance += Number(wallet.balance) || 0;
      }

      let totalEvmBalance = 0;
      for (const wallet of evmWallets) {
        totalEvmBalance += Number(wallet.balance) || 0;
      }

      walletMessage += `<b> Summary</b>\n`;
      walletMessage += `Total Wallets: ${totalWallets}\n`;
      if (solanaWallets.length > 0) {
        walletMessage += `Total SOL: ${totalSolBalance.toFixed(4)} SOL\n`;
      }
      if (evmWallets.length > 0) {
        walletMessage += `Total ETH: ${totalEvmBalance.toFixed(4)} ETH\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
          Markup.button.callback("➕ Add Wallet", "add_wallet"),
        ],
        [
          Markup.button.callback("💳 Deposit", "deposit_sol"),
          Markup.button.callback("💸 Withdraw", "withdraw_sol"),
        ],
        [
          Markup.button.callback("📊 My Profile", "view_profile"),
          Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
        ],
      ]);

      await ctx.reply(walletMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("View wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to load wallets.");
      await ctx.reply("❌ An error occurred while loading your wallets.");
    }
  }

  // Handle view profile callback
  static async handleViewProfile(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("📊 Loading profile...");

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      // Check if user has a solana wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      const profileMessage = `
      <b>📊 Your Profile</b>
      
<b>Username:</b> ${username}
            
<b>Wallet Address:</b> ${hasSolanaWallet ? `<code>${user.solanaWallets[0].address}</code>` : "Not set up"}
      
<b>Balance:</b> ${hasSolanaWallet ? `${user.solanaWallets[0].balance} SOL` : "N/A"}
      
<b>Member Since:</b> ${user.created_at?.toLocaleString() || "Unknown"}
      
<b>Last Active:</b> ${user.last_seen?.toLocaleString() || "Never"}
      
<b>Status:</b> ${user.is_active ? "Active" : "Inactive"}
      
<b>Role:</b> ${user.role}
      
<b>Groups:</b> 0 (Coming Soon!)
      `;
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🏧 Bank Details", "view_bank_account"),
          Markup.button.callback("✍️ Update Bank Details", "update_bank_name"),
        ], [
          Markup.button.callback("Backup Wallet", "export_private_key"),
          Markup.button.callback("Back to Main Menu", "back_to_menu")],
      ]);

      await ctx.reply(profileMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("View profile error:", error);
      await ctx.answerCbQuery("❌ Failed to load profile.");
    }
  }

  // Handle create callback
  static async handleCreateAjo(ctx: Context): Promise<void> {
    await AjoCallbackHandlers.handleCreateAjo(ctx);
  }

  // Handle join callback
  static async handleJoinAjo(ctx: Context): Promise<void> {
    await AjoCallbackHandlers.handleJoinAjo(ctx);
  }

  // Handle show help callback
  static async handleShowHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Help & Commands");

      const helpMessage =
        `<b>❓ Help & Commands</b>

<b>Available Commands:</b>
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/help - Show this help message
/ping - Check if bot is alive
/info - Get bot information


/create_group - Create a group
/join_group group_id - Join a group
/vote poll_id yes/no - Vote on polls
/history - View trading history

<b>Need Support?</b>
Contact @your_support_username for help!`

      await ctx.reply(helpMessage, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Show help error:", error);
      await ctx.answerCbQuery("❌ Failed to show help.");
    }
  }

  // Handle show about callback
  static async handleShowAbout(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("ℹ️ About Jumpa");

      const aboutMessage = `
ℹ️ **About Jumpa Bot**

**What is Jumpa?**
Jumpa is a Telegram bot that enables collaborative trading through groups - traditional savings groups reimagined for the digital age.

**Key Features:**
🔑 **Auto-generated Solana wallets** for each user
💰 **Collective fund pooling** with SOL
🗳️ **Democratic voting** on trading decisions
📊 **Transparent profit sharing** based on contributions
🔒 **Secure smart contract integration**

**How It Works:**
1. Create or join an group
2. Contribute SOL to the group pool
3. Vote on trading proposals
4. Share profits based on your contribution

**Built on Solana** for fast, cheap transactions!

**Version:** 1.0.0 (MVP)
**Status:** In Development
      `;

      await ctx.reply(aboutMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Show about error:", error);
      await ctx.answerCbQuery("❌ Failed to show about.");
    }
  }

  // Handle generate wallet callback
  static async handleGenerateWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔑 Generating wallet...");

      // Get user to check if they already have a wallet
      const user = await getUser(telegramId, username);
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register first.");
        return;
      }

      // Check if user already has a wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      if (hasSolanaWallet) {
        await ctx.reply("✅ You already have a wallet set up!");
        return;
      }

      // Generate new wallet
      const newWallet = await createNewSolanaWallet(telegramId);

      // Add wallet to user
      await addSolanaWalletToUser(
        telegramId,
        newWallet.address,
        newWallet.private_key_encrypted
      );

      const successMessage = `✅ **Wallet Generated Successfully!**

📍 **Your Wallet Address:**
\`${newWallet.address}\`

⚠️ **Important:** Save your private key securely. You'll need it to access your wallet:

\`${newWallet.private_key}\`

🔐 **Security Warning:**
- Never share your private key with anyone
- Store it in a safe place
- You can export your wallet later from the wallet menu

Ready to start trading!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🏠 Back to Main Menu", "back_to_menu")],
      ]);

      await ctx.reply(successMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Generate wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to generate wallet.");
      await ctx.reply("❌ An error occurred while generating your wallet. Please try again.");
    }
  }

  // Handle import wallet callback
  static async handleImportWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("📥 Import wallet");

      // Get user to check if they already have a wallet
      const user = await getUser(
        telegramId,
        ctx.from?.username || ctx.from?.first_name || "Unknown"
      );
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register first.");
        return;
      }

      // Check if user already has a wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      if (hasSolanaWallet) {
        await ctx.reply("✅ You already have a wallet set up!");
        return;
      }

      // Set state to await private key
      setUserActionState(telegramId, {
        action: "awaiting_import_private_key",
      });

      const importMessage = `📥 **Import Existing Wallet**

Paste your Solana private key (base58 or hex format).

⚠️ **Note:**
- Your private key will be encrypted and stored securely.
- Never share your private key with anyone

Type /cancel to cancel this operation.`;

      await ctx.reply(importMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Import wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to start import process.");
      await ctx.reply("❌ An error occurred. Please try again.");
    }
  }

  // Handle private key import
  static async handlePrivateKeyImport(
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
        await ctx.reply("⚠️ This wallet is already imported.");
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

      const successMessage = `✅ **Wallet Imported Successfully!**

📍 **Your Wallet Address:**
\`${walletAddress}\`

Ready to start trading!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🏠 Back to Main Menu", "back_to_menu")],
      ]);

      await ctx.reply(successMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Private key import error:", error);
      clearUserActionState(telegramId);
      await ctx.reply(
        "❌ An error occurred while importing your wallet. Please try again."
      );
    }
  }

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
          Markup.button.callback("🟣 Solana", "add_wallet_solana"),
          Markup.button.callback("🔵 EVM", "add_wallet_evm"),
        ],
        [
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

  // Handle back to main menu callback
  static async handleBackToMenu(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🏠 Back to Main Menu");

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      // Check if user has a solana wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      if (!hasSolanaWallet) {
        // Show wallet setup options
        const setupMessage = `Welcome to Jumpa Bot, ${username}!

🔐 **Wallet Setup Required**

You need to set up a Solana wallet to continue.

Choose an option:`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔑 Generate New Wallet",
              "generate_wallet"
            ),
            Markup.button.callback(
              "📥 Import Existing Wallet",
              "import_wallet"
            ),
          ],
        ]);

        await ctx.reply(setupMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        return;
      }

      const welcomeMessage = `
 Welcome to Jumpa Bot, ${username}!

 Your Wallet: \`${user.solanaWallets[0].address}\`

 Balance: ${user.solanaWallets[0].balance} SOL


      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔑 View Wallet", "view_wallet"),
          Markup.button.callback("📊 My Profile", "view_profile"),
        ],
        [
          Markup.button.callback("🏠 Create Group", "create_group"),
          Markup.button.callback("👥 Join Group", "join_group"),
        ],
        [
          Markup.button.callback("📊 Group Info", "group_info"),
        ],
        [
          Markup.button.callback("Deposit", "deposit_sol"),
          Markup.button.callback("Withdraw", "withdraw_sol"),
        ],
        [
          Markup.button.callback("❓ Help & Commands", "show_help"),
          Markup.button.callback("ℹ️ About Jumpa", "show_about"),
        ],
        [Markup.button.callback("🔄 Refresh", "back_to_menu")] //fix this later
      ]);

      await ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Back to menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to main menu.");
    }
  }
}
