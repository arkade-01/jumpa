import { Context, Markup } from "telegraf";
import { getOrder } from "./getOrder";
import User from "@database/models/user";
import { setOrderState } from "@shared/state/orderState";
import { getTradeState, clearTradeState } from "@shared/state/tradeState";

export async function createBuyOrder(ctx: Context, tradeId: string, amount: number) {
    try {
        if (!ctx.from) {
            return ctx.reply("User not identified.");
        }

        const user = await User.findOne({ telegram_id: ctx.from.id });
        if (!user) {
            return ctx.reply("User not found. Please /start to create a wallet.");
        }

        const tradeInfo = getTradeState(tradeId);
        if (!tradeInfo) {
            await ctx.reply("This trade request has expired. Please find the token again to start a new trade.");
            return;
        }
        const { contractAddress: tokenAddress, symbol, decimals } = tradeInfo;

        const slippageBps = 200; // 2% Hardcoded the slippage for now

        // await ctx.answerCbQuery("Fetching order details...");

        const order = await getOrder(
            ctx,
            tokenAddress,
            amount,
            slippageBps,
            user.solanaWallets[0].address
        );

        if (!order.success) {
            if (order.error === "Invalid outputMint") {
                await ctx.reply("This token is not supported for trading at the moment, possibly due to low liquidity.");
                return;
            }
            if (order.error === "Insufficient funds") {
                await ctx.reply("You have insufficient SOL to complete this transaction. Please deposit SOL into your wallet.");
                return;
            }
            await ctx.reply(`Error fetching order: ${order.error}`);
            return;
        }

        clearTradeState(tradeId);

        setOrderState(ctx.from.id, {
            transactionBase64: order.transactionBase64,
            requestId: order.requestId,
        });

        const formattedOutAmount = (order.outAmount / Math.pow(10, decimals)).toFixed(4);
        const feeInSol = order.fee / 1e9;

        const orderDetails = `
<b>Order Details</b>
-------------------
<b>Token Address:</b> <code> ${tokenAddress} </code> \n
<b>Amount:</b> ${amount} SOL
<b>Slippage:</b> ${slippageBps / 100}%
-------------------
<b>You will receive:</b> ${formattedOutAmount} ${symbol}\n
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
        console.error("Error in createBuyOrder:", error);
        await ctx.reply("An unexpected error occurred while creating the buy order.");
    }
}
