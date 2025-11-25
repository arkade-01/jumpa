import { Context } from "telegraf";
import { Markup } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";

/**
 * Display the main menu with user's wallet balances
 * Used by both StartCommand and MenuHandlers for consistency
 * @param ctx - Telegram context
 * @param telegramId - User's Telegram ID
 * @param username - User's username
 * @param shouldEdit - Whether to edit existing message (true) or send new message (false)
 */
export async function displayMainMenu(
  ctx: Context,
  telegramId: number,
  username: string,
  shouldEdit: boolean = true
): Promise<void> {
  // Get user from database
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return;
  }

  // Check if user has a Solana wallet
  const hasSolanaWallet =
    user.solanaWallets &&
    user.solanaWallets.length > 0 &&
    user.solanaWallets[0].address;

  if (!hasSolanaWallet) {
    // Show wallet setup options
    const firstName = ctx.from?.first_name || username;
    const setupMessage = `Welcome to Jumpa Bot, ${firstName}!

🔐 **Wallet Setup Required**

You need to set up a Solana wallet to continue.

Choose an option:`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔑 Generate New Solana Wallet", "generate_wallet")],
      [Markup.button.callback("📥 Import Existing Solana Wallet", "import_wallet")],
    ]);

    if (shouldEdit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(setupMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      } catch (error) {
        // If edit fails (message too old or deleted), send new message
        await ctx.reply(setupMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      }
    } else {
      await ctx.reply(setupMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    }
    return;
  }

  // User has wallet, show normal menu
  const firstName = ctx.from?.first_name || username;

  // Fetch USDT and USDC balance for Solana
  const tokenBalances = await getAllTokenBalances(user.solanaWallets[0].address);

  // Check if user has EVM wallet
  const hasEvmWallet =
    user.evmWallets &&
    user.evmWallets.length > 0 &&
    user.evmWallets[0].address;

  let evmBalances = null;
  if (hasEvmWallet) {
    // Fetch EVM balances for Celo and Base
    evmBalances = await getAllEvmBalances(user.evmWallets[0].address);
  }

  // Build welcome message
  let welcomeMessage = `Welcome to Jumpa Bot, ${firstName}!

*--- Your Solana Wallet ---*

\`${user.solanaWallets[0].address}\`

SOL: ${user.solanaWallets[0].balance.toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}
`;

  // Add EVM wallet section only if user has one
  if (hasEvmWallet && evmBalances) {
    welcomeMessage += `
*--- Your EVM Wallet ---*

\`${user.evmWallets[0].address}\`

*Celo:*
ETH: ${evmBalances.CELO.eth.toFixed(4)}   • USDC: ${evmBalances.CELO.usdc.toFixed(2)}   • USDT: ${evmBalances.CELO.usdt.toFixed(2)}

*Base:*
ETH: ${evmBalances.BASE.eth.toFixed(4)}   • USDC: ${evmBalances.BASE.usdc.toFixed(2)}   • USDT: ${evmBalances.BASE.usdt.toFixed(2)}
`;
  }

  welcomeMessage += `
`;

  // Create inline keyboard for quick actions
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(" View Wallet", "view_wallet"),
      Markup.button.callback(" My Profile", "view_profile"),
    ],
    [
      Markup.button.callback(" Create Group", "create_group"),
      Markup.button.callback(" Join  Group", "join"),
    ],
    [
      Markup.button.callback(" Group Info", "group_info"),
    ],
    [
      Markup.button.callback("Deposit", "deposit_sol"),
      Markup.button.callback("Withdraw", "withdraw_sol"),
    ],
    [
      Markup.button.callback(" Help & Commands", "show_help"),
      Markup.button.callback(" About Jumpa", "show_about"),
    ],
    [Markup.button.callback("Referral", "referral")],
    [Markup.button.callback("🔄 Refresh", "back_to_menu")]
  ]);

  if (shouldEdit && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(welcomeMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      // If edit fails (message too old or deleted), send new message
      await ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    }
  } else {
    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  }
}
