import { Context, Markup } from "telegraf";
import { getUserTokenHoldings } from "@features/trading/utils/getUserTokenHoldings";
import { setCarouselState, getCarouselState, navigateCarousel } from "@shared/state/tokenCarouselState";
import { generateTokenInfoMessage } from "@features/trading/utils/DetectTokenAddress";

/**
 * Start the token management carousel
 * Shows the first token in the user's holdings
 */
export async function handleManageTokens(ctx: Context) {
  try {
    const userId = ctx.from!.id;

    // Show loading state
    await ctx.answerCbQuery("Loading tokens...");

    // Fetch user's token holdings
    const holdings = await getUserTokenHoldings(userId);

    if (!holdings || holdings.length === 0) {
      await ctx.reply("You don't have any tokens to manage yet.");
      return;
    }

    // Initialize carousel state with token addresses
    const tokenAddresses = holdings.map(h => h.tokenAddress);
    setCarouselState(userId, {
      currentIndex: 0,
      tokenAddresses
    });

    // Show first token
    await showTokenCarousel(ctx, userId);

  } catch (error) {
    console.error("Error in handleManageTokens:", error);
    await ctx.reply("An error occurred while loading your tokens.");
  }
}

/**
 * Handle navigation between tokens (Next/Prev)
 */
export async function handleCarouselNavigate(ctx: Context) {
  try {
    const userId = ctx.from!.id;
    const callbackData = (ctx.callbackQuery as any).data;
    const direction = callbackData.split(":")[1] as 'next' | 'prev' | 'refresh' | 'retry';

    // Update index in state only for next/prev
    if (direction === 'next' || direction === 'prev') {
      navigateCarousel(userId, direction);
    }
    // For refresh/retry, we keep the same index and just re-render

    // Show token at new index
    await ctx.answerCbQuery();
    await showTokenCarousel(ctx, userId);

  } catch (error) {
    console.error("Error in handleCarouselNavigate:", error);
    await ctx.answerCbQuery("Navigation failed");
  }
}

/**
 * Display the token at the current index with navigation controls
 */
async function showTokenCarousel(ctx: Context, userId: number) {
  const state = getCarouselState(userId);
  if (!state) {
    await ctx.editMessageText("Token session expired. Please click 'Manage Tokens' again.");
    return;
  }

  const tokenAddress = state.tokenAddresses[state.currentIndex];

  try {
    // Reuse existing function to generate standard token interface
    const tokenData = await generateTokenInfoMessage(tokenAddress);

    // Customize keyboard: Intercept "Refresh" button to keep carousel context
    const originalKeyboard = tokenData.privateChatOptions.reply_markup.inline_keyboard;
    const modifiedKeyboard = originalKeyboard.map(row =>
      row.map(btn => {
        // Check if button is a callback button and is the Refresh button
        if ('callback_data' in btn && btn.callback_data?.startsWith('refresh:')) {
          return Markup.button.callback("🔄 Refresh", "carousel_nav:refresh");
        }
        return btn;
      })
    );

    // Build Navigation Row: [Prev] [Index/Total] [Next]
    const navRow = [];

    // Prev button (only if not first)
    if (state.currentIndex > 0) {
      navRow.push(Markup.button.callback("◀️ Prev", "carousel_nav:prev"));
    }

    // Position indicator (non-clickable)
    navRow.push(Markup.button.callback(
      `${state.currentIndex + 1}/${state.tokenAddresses.length}`,
      "ignore_action"
    ));

    // Next button (only if not last)
    if (state.currentIndex < state.tokenAddresses.length - 1) {
      navRow.push(Markup.button.callback("▶️ Next", "carousel_nav:next"));
    }

    // Combine Navigation Row + Modified Token Actions + Back Button
    const newKeyboard = Markup.inlineKeyboard([
      navRow,
      ...modifiedKeyboard,
      [Markup.button.callback("🔙 Back to Menu", "back_to_menu")]
    ]);

    // Update message
    await ctx.editMessageText(tokenData.metricsMessage, {
      parse_mode: "HTML",
      ...newKeyboard
    });

  } catch (error: any) {
    console.error("Error showing token carousel:", error);

    if (error.message === "RATE_LIMIT_ERROR") {
      await ctx.editMessageText("⏳ Rate limit. Please wait a moment...", {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Retry", `carousel_nav:retry`)], // Hacky retry using nav handler logic or could just keep same index
          [Markup.button.callback("🔙 Back to Menu", "back_to_menu")]
        ]).reply_markup
      });
    } else {
      await ctx.editMessageText(`❌ Error loading token data: ${error.message}`, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Back to Menu", "back_to_menu")]
        ]).reply_markup
      });
    }
  }
}
