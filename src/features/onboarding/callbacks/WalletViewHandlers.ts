import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";
import { getAmadeusBalance } from "@src/blockchain/amadeus/amadeusFunctions";

/**
 * Build skeleton wallet view with loading indicators
 */
function buildWalletSkeleton(user: any): string {
  let message = "*Your Wallets*\n\n";

  // Solana wallets
  const solanaWallets = user.solanaWallets || [];
  if (solanaWallets.length > 0) {
    message += `*🟣 Solana Wallets (${solanaWallets.length}/3)*\n`;

    for (let index = 0; index < solanaWallets.length; index++) {
      const wallet = solanaWallets[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";
      message += `\n\`${wallet.address}\`${defaultBadge}\n`;
      message += `SOL: ...   • USDC: ...   • USDT: ...\n`;
    }
    message += `\n`;
  }

  // EVM wallets
  const evmWallets = user.evmWallets || [];
  if (evmWallets.length > 0) {
    message += `*🔵 EVM Wallets (${evmWallets.length}/3)*\n`;

    for (let index = 0; index < evmWallets.length; index++) {
      const wallet = evmWallets[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";
      message += `\n\`${wallet.address}\`${defaultBadge}\n`;
      message += `*Base:* ... ETH • ... USDC\n`;
      message += `*Celo:* ... ETH • ... cUSD\n`;
    }
    message += `\n`;
  }

  // Amadeus wallets
  const amadeusWallets = user.amadeusWallets || [];
  if (amadeusWallets.length > 0) {
    message += `*🟡 Amadeus Wallets (${amadeusWallets.length}/3)*\n`;

    for (let index = 0; index < amadeusWallets.length; index++) {
      const wallet = amadeusWallets[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";
      message += `\n\`${wallet.publicKey}\`${defaultBadge}\n`;
      message += `AMA: ...\n`;
    }
    message += `\n`;
  }

  return message;
}

/**
 * Build complete wallet view with real balances
 */
function buildWalletComplete(
  user: any,
  solBalancesArray: any[],
  evmBalancesArray: any[],
  amaBalancesArray: (number | null)[]
): string {
  let message = "*Your Wallets*\n\n";

  // Solana wallets
  const solanaWallets = user.solanaWallets || [];
  if (solanaWallets.length > 0) {
    message += `*🟣 Solana Wallets (${solanaWallets.length}/3)*\n`;

    for (let index = 0; index < solanaWallets.length; index++) {
      const wallet = solanaWallets[index];
      const balances = solBalancesArray[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";

      message += `\n\`${wallet.address}\`${defaultBadge}\n`;

      if (balances) {
        message += `SOL: ${balances.sol.toFixed(2)}   • `;
        message += `USDC: ${balances.usdc.toFixed(2)}   • `;
        message += `USDT: ${balances.usdt.toFixed(2)}\n`;
      } else {
        message += `SOL: 0.00   • USDC: 0.00   • USDT: 0.00\n`;
      }
    }
    message += `\n`;
  }

  // EVM wallets
  const evmWallets = user.evmWallets || [];
  if (evmWallets.length > 0) {
    message += `*🔵 EVM Wallets (${evmWallets.length}/3)*\n`;

    for (let index = 0; index < evmWallets.length; index++) {
      const wallet = evmWallets[index];
      const balances = evmBalancesArray[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";

      message += `\n\`${wallet.address}\`${defaultBadge}\n`;

      if (balances) {
        message += `*Base:* ${balances.BASE.eth.toFixed(2)} ETH • ${balances.BASE.usdc.toFixed(2)} USDC\n`;
        message += `*Celo:* ${balances.CELO.eth.toFixed(2)} ETH • ${balances.CELO.usdc.toFixed(2)} cUSD\n`;
      } else {
        message += `*Base:* 0.00 ETH • 0.00 USDC\n`;
        message += `*Celo:* 0.00 ETH • 0.00 cUSD\n`;
      }
    }
    message += `\n`;
  }

  // Amadeus wallets
  const amadeusWallets = user.amadeusWallets || [];
  if (amadeusWallets.length > 0) {
    message += `*🟡 Amadeus Wallets (${amadeusWallets.length}/3)*\n`;

    for (let index = 0; index < amadeusWallets.length; index++) {
      const wallet = amadeusWallets[index];
      const balance = amaBalancesArray[index];
      const defaultBadge = index === 0 ? " 🟢 *(Default)*\n" : "";

      message += `\n\`${wallet.publicKey}\`${defaultBadge}\n`;
      message += `AMA: ${balance ? Number(balance).toFixed(2) : "0.00"}\n`;
    }
    message += `\n`;
  }

  return message;
}

/**
 * Fetch balances and update wallet view in background
 */
async function fetchAndUpdateWalletBalances(
  ctx: Context,
  chatId: number,
  messageId: number,
  user: any,
  forceRefresh: boolean = false
): Promise<void> {
  try {
    console.log(`🔄 Fetching wallet balances (forceRefresh: ${forceRefresh})`);

    const solanaWallets = user.solanaWallets || [];
    const evmWallets = user.evmWallets || [];
    const amadeusWallets = user.amadeusWallets || [];

    // Fetch all balances in parallel
    const [solBalancesArray, evmBalancesArray, amaBalancesArray] = await Promise.all([
      // Fetch all Solana wallet balances
      Promise.all(
        solanaWallets.map((wallet: any) =>
          getAllTokenBalances(wallet.address, forceRefresh)
        )
      ),
      // Fetch all EVM wallet balances
      Promise.all(
        evmWallets.map((wallet: any) =>
          getAllEvmBalances(wallet.address, forceRefresh)
        )
      ),
      // Fetch all Amadeus wallet balances
      Promise.all(
        amadeusWallets.map((wallet: any) =>
          getAmadeusBalance(wallet.publicKey)
        )
      )
    ]);

    console.log("✅ Wallet balances fetched");

    // Build complete message
    const completeMessage = buildWalletComplete(
      user,
      solBalancesArray,
      evmBalancesArray,
      amaBalancesArray
    );

    // Build keyboard
    const keyboard = buildWalletKeyboard(user);

    // Update message
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        completeMessage,
        {
          parse_mode: "Markdown",
          ...keyboard
        }
      );
      console.log("✅ Wallet view updated");
    } catch (error: any) {
      if (error?.message?.includes("message is not modified")) {
        console.log("Wallet content unchanged");
      } else {
        console.error("Failed to update wallet view:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Wallet balance fetch failed:", error);
  }
}

/**
 * Build wallet keyboard with all buttons
 */
function buildWalletKeyboard(user: any) {
  const solanaWallets = user.solanaWallets || [];
  const evmWallets = user.evmWallets || [];
  const amadeusWallets = user.amadeusWallets || [];

  const keyboardButtons = [
    [
      Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
      Markup.button.callback("➕ Add Wallet", "add_wallet"),
    ],
  ];

  // Add "Set as Default" buttons for Solana wallets (skip first one)
  if (solanaWallets.length > 1) {
    const solanaButtons = [];
    for (let i = 1; i < solanaWallets.length; i++) {
      solanaButtons.push(
        Markup.button.callback(`Set SOL Wallet ${i + 1} as Main`, `set_default_solana:${i}`)
      );
    }
    for (let i = 0; i < solanaButtons.length; i += 2) {
      keyboardButtons.push(solanaButtons.slice(i, i + 2));
    }
  }

  // Add "Set as Default" buttons for EVM wallets (skip first one)
  if (evmWallets.length > 1) {
    const evmButtons = [];
    for (let i = 1; i < evmWallets.length; i++) {
      evmButtons.push(
        Markup.button.callback(`Set EVM ${i + 1} as Main`, `set_default_evm:${i}`)
      );
    }
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
    for (let i = 0; i < deleteButtons.length; i += 2) {
      keyboardButtons.push(deleteButtons.slice(i, i + 2));
    }
  }

  keyboardButtons.push([
    Markup.button.callback("📊 My Profile", "view_profile"),
    Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
  ]);

  return Markup.inlineKeyboard(keyboardButtons);
}

export class WalletViewHandlers {
  // Handle view wallet callback
  static async handleViewWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery?.("❌ Unable to identify your account.");
        return;
      }

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      const solanaWallets = user.solanaWallets || [];
      const evmWallets = user.evmWallets || [];
      const amadeusWallets = user.amadeusWallets || [];
      const totalWallets = solanaWallets.length + evmWallets.length + amadeusWallets.length;

      if (totalWallets === 0) {
        const noWalletMessage = `*Your Wallets*\n\nYou don't have any wallets yet.\n\nSet up a wallet to start trading!`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("� Generate New Solana Wallet", "generate_wallet"),
          ],
          [
            Markup.button.callback("📥 Import Existing Solana Wallet", "import_wallet"),
          ],
          [
            Markup.button.callback("🔙 Back to Menu", "back_to_menu"),
          ],
        ]);

        // Handle message sending/editing
        if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
          await ctx.editMessageText(noWalletMessage, {
            parse_mode: "Markdown",
            ...keyboard,
          });
          await ctx.answerCbQuery?.("No wallets found");
        } else {
          await ctx.reply(noWalletMessage, {
            parse_mode: "Markdown",
            ...keyboard,
          });
        }
        return;
      }

      // Build skeleton message
      const skeletonMessage = buildWalletSkeleton(user);
      const keyboard = buildWalletKeyboard(user);

      // Send or edit message
      let chatId: number;
      let messageId: number;

      if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
        // Edit existing message for callbacks
        await ctx.editMessageText(skeletonMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        chatId = ctx.callbackQuery.message.chat.id;
        messageId = ctx.callbackQuery.message.message_id;
        await ctx.answerCbQuery?.("🔑 Loading wallets...");
        console.log("✅ Wallet skeleton edited (callback)");
      } else {
        // Send new message for commands
        const sent = await ctx.reply(skeletonMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        chatId = sent.chat.id;
        messageId = sent.message_id;
        console.log("✅ Wallet skeleton sent (command)");
      }

      // Fetch balances in background (fire-and-forget)
      fetchAndUpdateWalletBalances(
        ctx,
        chatId,
        messageId,
        user,
        false // forceRefresh
      ).catch(error => {
        console.error("Background wallet fetch error:", error);
      });

    } catch (error) {
      console.error("View wallet error:", error);
      await ctx.answerCbQuery?.("❌ Failed to load wallets.");
      await ctx.reply("❌ An error occurred while loading your wallets.");
    }
  }
}
