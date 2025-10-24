import { Context } from "telegraf";
import { getOrderState, clearOrderState } from "../../state/orderState";
import { executeOrder } from "../../trading/executeOrder";

export class BuyCallbackHandlers {
  public static async handleApprove(ctx: Context) {

    if (!ctx.from) {
      return ctx.reply("User not identified.");
    }

    const orderState = getOrderState(ctx.from.id);
    if (!orderState) {
      return ctx.reply("Order not found or has expired.");
    }

    const callbackData = (ctx.callbackQuery as any).data;
    const requestId = callbackData.split(":")[1];
    const decimals = parseInt(callbackData.split(":")[2]);
    const symbol = callbackData.split(":")[3];

    if (orderState.requestId !== requestId) {
      return ctx.reply("This approval is for a different order.");
    }

    await ctx.answerCbQuery("Executing order...");

    const result = await executeOrder(ctx, orderState.transactionBase64, orderState.requestId);

    if (result.success) {
      const responseMsg = `✅ Swap successful!\n\n<a href="${result.explorerUrl}">View on Solscan</a>\n\nYou received ${(result.amountReceived / Math.pow(10, decimals)).toFixed(4)} ${symbol}`;

      await ctx.editMessageText(responseMsg, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
    } else {
      await ctx.editMessageText(`❌ Trade failed: ${result.error}`);
    }

    clearOrderState(ctx.from.id);
  }

  public static async handleDecline(ctx: Context) {
    if (!ctx.from) {
      return ctx.reply("User not identified.");
    }
    await ctx.answerCbQuery("Order declined.");
    await ctx.editMessageText("Buy order has been declined.");
    clearOrderState(ctx.from.id);
  }
}