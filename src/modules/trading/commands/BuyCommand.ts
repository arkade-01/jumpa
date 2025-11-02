import { Context } from "telegraf";
import { createBuyOrder } from "@modules/trading/utils/createBuyOrder";

export async function handleBuy(ctx: Context) {
  try {
    const callbackData = (ctx.callbackQuery as any).data;
    const parts = callbackData.split(":");
    const tradeId = parts[1];
    const amount = parseFloat(parts[2]);

    if (!tradeId || isNaN(amount)) {
        await ctx.answerCbQuery("Invalid buy command.");
        return;
    }

    await createBuyOrder(ctx, tradeId, amount);

  } catch (error) {
    console.error("Error in handleBuy:", error);
    await ctx.answerCbQuery("An unexpected error occurred.");
  }
}