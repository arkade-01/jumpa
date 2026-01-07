import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { getAllEvmBalances } from "@shared/utils/getEvmBalances";
import { sendOrEdit } from "@shared/utils/messageHelper";
import {
  buildPrivateChatKeyboard,
  buildGroupChatKeyboard,
  buildWalletSetupKeyboard,
} from "./keyboardBuilders";
import { getAmadeusBalance } from "@src/blockchain/amadeus/amadeusFunctions";

/**
 * Display the main menu with user's wallet balances.
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

  const hasAmadeusWallet =
    user.amadeusWallets &&
    user.amadeusWallets.length > 0 &&
    user.amadeusWallets[0].publicKey;
  console.log("Has Amadeus Wallet:", hasAmadeusWallet);

  const hasEvmWallet =
    user.evmWallets && user.evmWallets.length > 0 && user.evmWallets[0].address;
  console.log("Has EVM Wallet:", hasEvmWallet);

  if (!hasSolanaWallet && !hasEvmWallet) {
    // Show wallet setup options
    const firstName = ctx.from?.first_name || username;
    const setupMessage = `Welcome to Jumpa Bot, ${firstName}!

You need to set up a wallet to trade and perform P2P transactions.

Choose an option below to get started:`;

    const keyboard = buildWalletSetupKeyboard();

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

  // Fetch balances in parallel
  const [tokenBalances, evmBalances, amadeusBalances] = await Promise.all([
    hasSolanaWallet
      ? getAllTokenBalances(user.solanaWallets[0].address)
      : Promise.resolve(null),
    hasEvmWallet
      ? getAllEvmBalances(user.evmWallets[0].address)
      : Promise.resolve(null),
    hasAmadeusWallet
      ? getAmadeusBalance(user.amadeusWallets[0].publicKey)
      : Promise.resolve(null)
  ]);

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

  // Add Amadeus wallet section only if user has one
  if (hasAmadeusWallet && amadeusBalances) {
    welcomeMessage += `
*--- Your Amadeus Wallet ---*

\`${user.amadeusWallets[0].publicKey}\`

AMA: ${amadeusBalances}
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

  // Detect chat type and build appropriate keyboard
  const chatType = ctx.chat?.type;
  const isGroupChat = chatType === "group" || chatType === "supergroup";

  // Create inline keyboard based on chat type
  const keyboard = isGroupChat
    ? buildGroupChatKeyboard()
    : buildPrivateChatKeyboard();

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
