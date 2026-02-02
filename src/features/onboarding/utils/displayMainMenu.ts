import { Context, Markup } from "telegraf";
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
import { getUserTokenHoldings } from "@features/trading/utils/getUserTokenHoldings";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build skeleton message with loading indicators
 */
function buildSkeletonMessage(
  user: any,
  firstName: string,
  isPrivateChat: boolean,
  isGroupChat: boolean,
  hasTokenHoldings: boolean,
  tokenHoldings: any[] | null,
  hasSolanaWallet: boolean,
  hasAmadeusWallet: boolean,
  hasEvmWallet: boolean
): string {
  let message = `Welcome to Jumpa Bot, ${firstName}!\n`;

  // If user has token holdings in private chat, show smart portfolio skeleton
  if (isPrivateChat && hasTokenHoldings && tokenHoldings && tokenHoldings.length > 0) {
    message += `\n*--- Your Tokens ---*\n\n`;

    tokenHoldings.slice(0, 10).forEach(token => {
      message += `*${token.symbol}* ${token.netAmount.toFixed(2)} \n`;
      message += `Value: ... • P/L: ...\n`;
      message += `5m: ...  |  15m: ...  |  24h: ...\n`;
      message += `MCap: ...\n\n`;
    });

    if (tokenHoldings.length > 10) {
      message += `\n_...and ${tokenHoldings.length - 10} more tokens_\n`;
    }
    message += `\nClick on 'Manage tokens' to buy/sell tokens in your wallets. Click on 'Manage wallet' to view and manage all your wallets. Use /start to return to this menu anytime`;

    return message;
  }

  // Show wallet balance skeletons
  if (hasSolanaWallet) {
    message += `
*--- Your Solana Wallet ---*

\`${user.solanaWallets[0].address}\`

SOL: ...   • USDC: ...   • USDT: ...
`;
  }

  if (hasAmadeusWallet) {
    message += `
*--- Your Amadeus Wallet ---*

\`${user.amadeusWallets[0].publicKey}\`

AMA: ...
`;
  }

  if (hasEvmWallet) {
    message += `
*--- Your EVM Wallet ---*

\`${user.evmWallets[0].address}\`

*Celo:*
ETH: ...   • USDC: ...   • USDT: ...

*Base:*
ETH: ...   • USDC: ...   • USDT: ...
`;
  }

  message += `\n`;
  return message;
}

/**
 * Build complete message with fetched balance data
 */
function buildCompleteMessage(
  user: any,
  firstName: string,
  isPrivateChat: boolean,
  isGroupChat: boolean,
  hasTokenHoldings: boolean,
  tokenHoldings: any[] | null,
  hasSolanaWallet: boolean,
  hasAmadeusWallet: boolean,
  hasEvmWallet: boolean,
  tokenBalances: any,
  amadeusBalances: any,
  evmBalances: any
): string {
  let message = `Welcome to Jumpa Bot, ${firstName}!\n`;

  // If user has token holdings in private chat, show ONLY portfolio
  if (isPrivateChat && hasTokenHoldings && tokenHoldings) {
    message += `\n*--- Your Tokens ---*\n\n`;

    tokenHoldings.slice(0, 10).forEach(holding => {
      // P/L indicator
      const plEmoji = (holding.profitLossPercent ?? 0) >= 0 ? '🟢' : '🔴';
      const plSign = (holding.profitLossPercent ?? 0) >= 0 ? '+' : '';

      // Format numbers
      const formatNum = (num: number | undefined) => {
        if (!num) return '$0';
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
      };

      const formatChange = (change: number | undefined) => {
        if (change === undefined) return 'N/A';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(1)}%`;
      };

      // Token header with P/L
      message += `*${holding.symbol}* ${holding.netAmount.toFixed(2)} \n`;
      message += `Value: ${formatNum(holding.currentValueUsd)} (${holding.currentValueSol?.toFixed(4) || '0.0000'} SOL) ${plEmoji}${plSign}${holding.profitLossPercent?.toFixed(2) || '0.00'}%\n`;
      message += `5m: ${formatChange(holding.priceChange5m)}  |  15m: ${formatChange(holding.priceChange15m)}  |  24h: ${formatChange(holding.priceChange24h)}\n`;
      message += `MCap: ${formatNum(holding.marketCap)}\n\n`;
    });

    if (tokenHoldings.length > 10) {
      message += `\n_...and ${tokenHoldings.length - 10} more tokens_\n`;
    }
    message += `\nClick on 'Manage tokens' to buy/sell tokens in your wallets. Click on 'Manage wallet' to view and manage all your wallets. Use /start to return to this menu anytime`;

    return message;
  }

  // Show regular wallet balances
  if (hasSolanaWallet && tokenBalances) {
    message += `
*--- Your Solana Wallet ---*

\`${user.solanaWallets[0].address}\`

SOL: ${user.solanaWallets[0].balance.toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}
`;
  }

  if (hasAmadeusWallet && amadeusBalances) {
    message += `
*--- Your Amadeus Wallet ---*

\`${user.amadeusWallets[0].publicKey}\`

AMA: ${amadeusBalances}
`;
  }

  if (hasEvmWallet && evmBalances) {
    message += `
*--- Your EVM Wallet ---*

\`${user.evmWallets[0].address}\`

*Celo:*
ETH: ${evmBalances.CELO.eth.toFixed(4)}   • USDC: ${evmBalances.CELO.usdc.toFixed(2)}   • USDT: ${evmBalances.CELO.usdt.toFixed(2)}

*Base:*
ETH: ${evmBalances.BASE.eth.toFixed(4)}   • USDC: ${evmBalances.BASE.usdc.toFixed(2)}   • USDT: ${evmBalances.BASE.usdt.toFixed(2)}
`;
  }

  message += `\n`;
  return message;
}

/**
 * Fetch balances and update the message asynchronously
 * This runs in the background and doesn't block the initial response
 */
async function fetchAndUpdateBalances(
  ctx: Context,
  chatId: number,
  messageId: number,
  user: any,
  telegramId: number,
  firstName: string,
  isPrivateChat: boolean,
  isGroupChat: boolean,
  hasSolanaWallet: boolean,
  hasAmadeusWallet: boolean,
  hasEvmWallet: boolean,
  forceRefresh: boolean = false
): Promise<void> {
  try {
    console.log(`🔄 Fetching balances in background... (forceRefresh: ${forceRefresh})`);

    // Fetch FULL token holdings with live price data (SLOW)
    const tokenHoldings = await getUserTokenHoldings(telegramId, true);
    const hasTokenHoldings = tokenHoldings && tokenHoldings.length > 0;

    // Fetch balances in parallel with force refresh flag
    const [tokenBalances, evmBalances, amadeusBalances] = await Promise.all([
      hasSolanaWallet
        ? getAllTokenBalances(user.solanaWallets[0].address, forceRefresh)
        : Promise.resolve(null),
      hasEvmWallet
        ? getAllEvmBalances(user.evmWallets[0].address, forceRefresh)
        : Promise.resolve(null),
      hasAmadeusWallet
        ? getAmadeusBalance(user.amadeusWallets[0].publicKey)
        : Promise.resolve(null)
    ]);

    console.log("✅ Balances fetched, updating message...");

    // Build complete message
    const completeMessage = buildCompleteMessage(
      user,
      firstName,
      isPrivateChat,
      isGroupChat,
      hasTokenHoldings,
      tokenHoldings,
      hasSolanaWallet,
      hasAmadeusWallet,
      hasEvmWallet,
      tokenBalances,
      amadeusBalances,
      evmBalances
    );

    // Build keyboard
    const baseKeyboard = isGroupChat
      ? buildGroupChatKeyboard()
      : buildPrivateChatKeyboard();

    // Add "Manage Tokens" button for private chats with tokens
    let finalKeyboard = baseKeyboard;
    if (isPrivateChat && hasTokenHoldings) {
      finalKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("Manage Tokens", "manage_tokens")],
        ...baseKeyboard.reply_markup.inline_keyboard
      ]);
    }

    // Edit the message directly using the stored message ID
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        completeMessage,
        {
          parse_mode: "Markdown",
          ...finalKeyboard,
        }
      );
      console.log("✅ Message updated with real balances");
    } catch (error: any) {
      // Check if the error is because the message content hasn't changed
      const isNotModifiedError =
        error?.message?.includes("message is not modified") ||
        error?.description?.includes("message is not modified");

      if (isNotModifiedError) {
        console.log("Message content unchanged, no edit needed");
      } else {
        // For other errors (message deleted, too old, etc.), log but don't crash
        console.error("Failed to edit message, error:", error.message || error);
      }
    }
  } catch (error) {
    console.error("❌ Failed to fetch/update balances:", error);
    // Fail silently - user already has the skeleton message
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Display the main menu with user's wallet balances.
 * Uses instant response pattern: shows skeleton immediately, then updates with real data.
 * Used by both StartCommand and MenuHandlers for consistency
 * @param ctx - Telegram context
 * @param telegramId - User's Telegram ID
 * @param username - User's username
 * @param forceRefresh - If true, bypass cache and fetch fresh data from blockchain
 */
export async function displayMainMenu(
  ctx: Context,
  telegramId: number,
  username: string,
  forceRefresh: boolean = false
): Promise<void> {
  // Get user from database (fast - no RPC calls)
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply("❌ User not found. Please use /start to register first.");
    return;
  }

  console.log("Displaying main menu for user:", username);

  // Check wallet availability
  const hasSolanaWallet = !!(
    user.solanaWallets &&
    user.solanaWallets.length > 0 &&
    user.solanaWallets[0].address
  );
  const hasAmadeusWallet = !!(
    user.amadeusWallets &&
    user.amadeusWallets.length > 0 &&
    user.amadeusWallets[0].publicKey
  );
  const hasEvmWallet = !!(
    user.evmWallets && user.evmWallets.length > 0 && user.evmWallets[0].address
  );

  console.log("Has Solana Wallet:", hasSolanaWallet);
  console.log("Has Amadeus Wallet:", hasAmadeusWallet);
  console.log("Has EVM Wallet:", hasEvmWallet);

  // Scenario 1: No wallet - show setup options (instant, no changes needed)
  if (!hasSolanaWallet && !hasEvmWallet) {
    const firstName = ctx.from?.first_name || username;
    const setupMessage = `Welcome to Jumpa Bot, ${firstName}!

You need to set up a wallet to trade and perform P2P transactions.

Choose an option below to get started:`;

    const keyboard = buildWalletSetupKeyboard();

    await sendOrEdit(ctx, setupMessage, {
      parse_mode: "Markdown",
      ...keyboard,
    });

    return;
  }

  // User has wallet - proceed with instant response pattern
  const firstName = ctx.from?.first_name || username;
  const chatType = ctx.chat?.type;
  const isPrivateChat = chatType === "private";
  const isGroupChat = chatType === "group" || chatType === "supergroup";

  // Fetch basic token data instantly (no price fetching - FAST)
  const basicTokenHoldings = await getUserTokenHoldings(telegramId, false);
  const hasTokenHoldings = basicTokenHoldings && basicTokenHoldings.length > 0;

  // Build and send skeleton message INSTANTLY with token names
  const skeletonMessage = buildSkeletonMessage(
    user,
    firstName,
    isPrivateChat,
    isGroupChat,
    hasTokenHoldings,
    basicTokenHoldings,
    hasSolanaWallet,
    hasAmadeusWallet,
    hasEvmWallet
  );

  const baseKeyboard = isGroupChat
    ? buildGroupChatKeyboard()
    : buildPrivateChatKeyboard();

  // Add "Manage Tokens" button for private chats with tokens (even in skeleton)
  let finalKeyboard = baseKeyboard;
  if (isPrivateChat && hasTokenHoldings) {
    finalKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Manage Tokens", "manage_tokens")],
      ...baseKeyboard.reply_markup.inline_keyboard
    ]);
  }

  // Send or edit skeleton message
  let chatId: number;
  let messageId: number;

  // If this is a callback query, edit the existing message
  if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.editMessageText(skeletonMessage, {
      parse_mode: "Markdown",
      ...finalKeyboard,
    });

    chatId = ctx.callbackQuery.message.chat.id;
    messageId = ctx.callbackQuery.message.message_id;
    console.log("✅ Skeleton message edited (callback)");
  } else {
    // For commands, send a new message
    const sentMessage = await ctx.reply(skeletonMessage, {
      parse_mode: "Markdown",
      ...finalKeyboard,
    });

    chatId = sentMessage.chat.id;
    messageId = sentMessage.message_id;
    console.log("✅ Skeleton message sent (command)");
  }

  // Fetch balances and update in background (fire-and-forget)
  fetchAndUpdateBalances(
    ctx,
    chatId,
    messageId,
    user,
    telegramId,
    firstName,
    isPrivateChat,
    isGroupChat,
    hasSolanaWallet,
    hasAmadeusWallet,
    hasEvmWallet,
    forceRefresh
  ).catch(error => {
    console.error("Background balance fetch error:", error);
    // Fail silently - user already has skeleton message
  });
}
