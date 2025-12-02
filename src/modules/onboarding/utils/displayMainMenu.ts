import { Context } from "telegraf";
import { Markup } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";
import { sendOrEdit } from "@shared/utils/messageHelper";

/**
 * Display the main menu with user's wallet balances
 * Used by both StartCommand and MenuHandlers for consistency
 * @param ctx - Telegram context
 * @param telegramId - User's Telegram ID
 * @param username - User's username */
export async function displayMainMenu(
  ctx: Context,
  telegramId: number,
  username: string
): Promise<void> {
  // Get user from database
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply("❌ User not found. Please use /start to register first.");
    return;
  }
  console.log("Displaying main menu for user:", username);
  // Check if user has a Solana wallet or evm wallet
  const hasSolanaWallet =
    user.solanaWallets &&
    user.solanaWallets.length > 0 &&
    user.solanaWallets[0].address;
  console.log("Has Solana Wallet:", hasSolanaWallet);
  const hasEvmWallet =
    user.evmWallets && user.evmWallets.length > 0 && user.evmWallets[0].address;
  console.log("Has EVM Wallet:", hasEvmWallet);

  if (!hasSolanaWallet && !hasEvmWallet) {
    // Show wallet setup options
    const firstName = ctx.from?.first_name || username;
    const setupMessage = `Welcome to Jumpa Bot, ${firstName}!

You need to set up a wallet to trade and perform P2P transactions.

Choose an option below to get started:`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(" Generate Solana Wallet", "generate_wallet"),
        Markup.button.callback(" Import Solana Wallet", "import_wallet"),
      ],
      [
        Markup.button.callback("Generate EVM Wallet", "generate_evm_wallet"),
        Markup.button.callback("Import EVM Wallet", "add_wallet_evm"),
      ],
    ]);

    try {
      await sendOrEdit(ctx, setupMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      // If edit fails (message too old or deleted), send new message
      await sendOrEdit(ctx, setupMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    }

    return;
  }

  // User has wallet, show normal menu
  const firstName = ctx.from?.first_name || username;

  // Fetch USDT and USDC balance for Solana only if user has Solana wallet
  let tokenBalances = null;
  if (hasSolanaWallet) {
    tokenBalances = await getAllTokenBalances(user.solanaWallets[0].address);
  }

  // Check if user has EVM wallet
  // const hasEvmWallet =
  //   user.evmWallets && user.evmWallets.length > 0 && user.evmWallets[0].address;

  let evmBalances = null;
  if (hasEvmWallet) {
    // Fetch EVM balances for Celo and Base
    evmBalances = await getAllEvmBalances(user.evmWallets[0].address);
  }

  // Build welcome message
  let welcomeMessage = `Welcome to Jumpa Bot, ${firstName}!
`;

  // Add Solana wallet section only if user has one
  if (hasSolanaWallet && tokenBalances) {
    welcomeMessage += `
*--- Your Solana Wallet ---*

\`${user.solanaWallets[0].address}\`

SOL: ${user.solanaWallets[0].balance.toFixed(
      4
    )}   • USDC: ${tokenBalances.usdc.toFixed(
      1
    )}   • USDT: ${tokenBalances.usdt.toFixed(1)}
`;
  }

  // Add EVM wallet section only if user has one
  if (hasEvmWallet && evmBalances) {
    welcomeMessage += `
*--- Your EVM Wallet ---*

\`${user.evmWallets[0].address}\`

*Celo:*
ETH: ${evmBalances.CELO.eth.toFixed(
      4
    )}   • USDC: ${evmBalances.CELO.usdc.toFixed(
      2
    )}   • USDT: ${evmBalances.CELO.usdt.toFixed(2)}

*Base:*
ETH: ${evmBalances.BASE.eth.toFixed(
      4
    )}   • USDC: ${evmBalances.BASE.usdc.toFixed(
      2
    )}   • USDT: ${evmBalances.BASE.usdt.toFixed(2)}
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
    [Markup.button.callback(" Group Info", "group_info")],
    [
      Markup.button.callback("Withdraw", "withdraw_sol"),
      Markup.button.callback("Referral", "referral"),
    ],
    [
      Markup.button.callback(" Help & Commands", "show_help"),
      Markup.button.callback(" About Jumpa", "show_about"),
    ],
    [Markup.button.callback("🔄 Refresh", "back_to_menu")],
  ]);

  try {
    await sendOrEdit(ctx, welcomeMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    // If edit fails (message too old or deleted), send new message
    await sendOrEdit(ctx, welcomeMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  }
}
