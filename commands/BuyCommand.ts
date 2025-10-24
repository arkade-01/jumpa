import { Context, Markup } from "telegraf";
import { getOrder } from "../trading/getOrder";
import User from "../models/user";
import { setOrderState } from "../state/orderState";

export async function handleBuy(ctx: Context) {
  try {
    if (!ctx.from) {
      return ctx.reply("User not identified.");
    }

    const user = await User.findOne({ telegram_id: ctx.from.id });
    if (!user) {
      return ctx.reply("User not found. Please /start to create a wallet.");
    }

    const callbackData = (ctx.callbackQuery as any).data;
    const parts = callbackData.split(":");
    const tokenAddress = parts[1];
    const amount = parseFloat(parts[2]);
    const decimals = parseInt(parts[3]);
    const symbol = parts[4];
 
    const slippageBps = 50; // Hardcoded the slippage for now

    await ctx.answerCbQuery("Fetching order details...");

    const order = await getOrder(
      ctx,
      tokenAddress,
      amount,
      slippageBps,
      user.wallet_address
    );
    console.log("Order response in buyCommand:", order);
    if (!order.success) {
      console.log("Order error in buyCommand:", order.error || '');
      if (order.error === "Invalid outputMint") {
        return ctx.reply("This token is not supported for trading at the moment, possibly due to low liquidity.");
      }
      if (order.error === "Insufficient funds") {
        return ctx.reply("You have insufficient SOL to complete this transaction. Please deposit SOL into your wallet.");
      }
      return ctx.reply(`Error fetching order: ${order.error}`);
    }

    // Store the order details for later execution
    setOrderState(ctx.from.id, {
      transactionBase64: order.transactionBase64,
      requestId: order.requestId,
    });

    // The outAmount is in the smallest unit of the token.
    // We need to know the token's decimals to display the correct amount.
    // For now, we display the raw amount with formatting.
    const formattedOutAmount = (order.outAmount / 1e9).toFixed(4);

    const feeInSol = order.fee / 1e9;

    const orderDetails = `
<b>Order Details</b>
-------------------
<b>Token Address:</b> ${tokenAddress}

<b>Amount:</b> ${amount} SOL
<b>Slippage:</b> ${slippageBps / 100}%
-------------------
<b>You will receive:</b> ${formattedOutAmount} tokens

<b>Price Impact:</b> ${order.priceImpact.toFixed(2)}%
<b>Fee:</b> ${feeInSol.toFixed(9)} SOL
`;

    await ctx.replyWithHTML(
      orderDetails,
      Markup.inlineKeyboard([
        Markup.button.callback("Approve", `approve_buy:${order.requestId}:${decimals}:${symbol}`),
        Markup.button.callback("Decline", "decline_buy"),
      ])
    );
  } catch (error) {
    console.error("Error in handleBuy:", error);
    await ctx.reply("An unexpected error occurred. Please try again later.");
  }
}