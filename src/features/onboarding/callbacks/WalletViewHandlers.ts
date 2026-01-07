import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";
import { sendOrEdit } from "@shared/utils/messageHelper";
import { getAmadeusBalance } from "@src/blockchain/amadeus/amadeusFunctions";

export class WalletViewHandlers {
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

        await sendOrEdit(ctx, noWalletMessage, {
          parse_mode: "HTML",
          ...keyboard,
        });
        return;
      }

      // Build wallet list message
      let walletMessage = `<b>Your Wallets</b>\n\n`;

      // Display Solana wallets
      if (solanaWallets.length > 0) {
        walletMessage += `<b>🟣 Solana Wallets (${solanaWallets.length}/3)</b>\n`;

        for (let index = 0; index < solanaWallets.length; index++) {
          const wallet = solanaWallets[index];
          const balance = wallet.balance?.toFixed(4) || "0.0000";

          // Fetch USDC and USDT balances for this wallet
          const tokenBalances = await getAllTokenBalances(wallet.address);

          const defaultBadge = index === 0 ? " 🟢 <b>(Default)</b>\n" : "";
          walletMessage += `\n<code>${wallet.address}</code>${defaultBadge}\n`;
          walletMessage += `SOL: ${balance}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}\n`;
        }
        walletMessage += `\n`;
      }

      // Display EVM wallets
      if (evmWallets.length > 0) {
        walletMessage += `<b>🔵 EVM Wallets (${evmWallets.length}/3)</b>\n`;

        for (let index = 0; index < evmWallets.length; index++) {
          const wallet = evmWallets[index];
          const balances = await getAllEvmBalances(wallet.address);

          const defaultBadge = index === 0 ? " 🟢 <b>(Default)</b>\n" : "";
          walletMessage += `\n<code>${wallet.address}</code>${defaultBadge}\n`;

          walletMessage += `<b>Base:</b> ${balances.BASE.eth.toFixed(4)} ETH • ${balances.BASE.usdc.toFixed(1)} USDC\n`;
          walletMessage += `<b>Celo:</b> ${balances.CELO.eth.toFixed(4)} ETH • ${balances.CELO.usdc.toFixed(1)} cUSD\n`;
        }
        walletMessage += `\n`;
      }

      // Display Amadeus wallets
      const amadeusWallets = user.amadeusWallets || [];
      if (amadeusWallets.length > 0) {
        walletMessage += `<b>⚫ Amadeus Wallets (${amadeusWallets.length}/3)</b>\n`;

        for (let index = 0; index < amadeusWallets.length; index++) {
          const wallet = amadeusWallets[index];
          const balance = await getAmadeusBalance(wallet.publicKey);

          const defaultBadge = index === 0 ? " 🟢 <b>(Default)</b>\n" : "";
          walletMessage += `\n<code>${wallet.publicKey}</code>${defaultBadge}\n`;
          walletMessage += `   Balance: ${balance} AMA\n`;
        }
        walletMessage += `\n`;
      }

      // Build keyboard with set default buttons
      const keyboardButtons = [
        [
          Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
          Markup.button.callback("➕ Add Wallet", "add_wallet"),
        ],
      ];

      // Add "Set as Default" buttons for Solana wallets (skip first one as it's already default)
      if (solanaWallets.length > 1) {
        const solanaButtons = [];
        for (let i = 1; i < solanaWallets.length; i++) {
          solanaButtons.push(
            Markup.button.callback(`Set SOL Wallet ${i + 1} as Main`, `set_default_solana:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < solanaButtons.length; i += 2) {
          keyboardButtons.push(solanaButtons.slice(i, i + 2));
        }
      }

      // Add "Set as Default" buttons for EVM wallets (skip first one as it's already default)
      if (evmWallets.length > 1) {
        const evmButtons = [];
        for (let i = 1; i < evmWallets.length; i++) {
          evmButtons.push(
            Markup.button.callback(`Set EVM ${i + 1} as Main`, `set_default_evm:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < evmButtons.length; i += 2) {
          keyboardButtons.push(evmButtons.slice(i, i + 2));
        }
      }

      // Add delete buttons for Solana wallets
      if (solanaWallets.length > 0) {
        const deleteButtons = [];
        for (let i = 0; i < solanaWallets.length; i++) {
          deleteButtons.push(
            Markup.button.callback(`Delete Sol Wallet ${i + 1}`, `delete_solana_wallet:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < deleteButtons.length; i += 2) {
          keyboardButtons.push(deleteButtons.slice(i, i + 2));
        }
      }

      // Add delete buttons for EVM wallets
      if (evmWallets.length > 0) {
        const deleteButtons = [];
        for (let i = 0; i < evmWallets.length; i++) {
          deleteButtons.push(
            Markup.button.callback(`🗑️ Delete EVM ${i + 1}`, `delete_evm_wallet:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < deleteButtons.length; i += 2) {
          keyboardButtons.push(deleteButtons.slice(i, i + 2));
        }
      }

      // Add "Set as Default" buttons for Amadeus wallets
      if (amadeusWallets.length > 1) {
        const amaButtons = [];
        for (let i = 1; i < amadeusWallets.length; i++) {
          amaButtons.push(
            Markup.button.callback(`Set AMA ${i + 1} as Main`, `set_default_ama:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < amaButtons.length; i += 2) {
          keyboardButtons.push(amaButtons.slice(i, i + 2));
        }
      }

      // Add delete buttons for Amadeus wallets
      if (amadeusWallets.length > 0) {
        const deleteButtons = [];
        for (let i = 0; i < amadeusWallets.length; i++) {
          deleteButtons.push(
            Markup.button.callback(`🗑️ Delete AMA ${i + 1}`, `delete_ama_wallet:${i}`)
          );
        }
        // Add buttons in rows of 2
        for (let i = 0; i < deleteButtons.length; i += 2) {
          keyboardButtons.push(deleteButtons.slice(i, i + 2));
        }
      }

      keyboardButtons.push(
        [
          Markup.button.callback("📊 My Profile", "view_profile"),
          Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
        ]
      );

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      await sendOrEdit(ctx, walletMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("View wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to load wallets.");
      await ctx.reply("❌ An error occurred while loading your wallets.");
    }
  }
}
