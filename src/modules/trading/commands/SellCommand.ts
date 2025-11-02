import { Context, Markup } from "telegraf";
import User from "@database/models/user";
import { setOrderState } from "@shared/state/orderState";
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from "@core/config/config";
import { getSellOrder } from "@modules/trading/utils/getSellOrder";
import { getTradeState, clearTradeState } from "@shared/state/tradeState";

//make sure to get the user's token balance or else it will trigger insufficient funds error
export async function handleSell(ctx: Context) {
  console.log("handleSell called");
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
    const tradeId = parts[1];
    const percentageToSell = parseFloat(parts[2]);

    const tradeInfo = getTradeState(tradeId);
    if (!tradeInfo) {
      return ctx.reply("This trade request has expired. Please find the token again to start a new trade.");
    }
    const { contractAddress: tokenAddress, symbol, decimals } = tradeInfo;

    let userTokenBalance; //initialize user token balance
    const slippageBps = 200; // Hardcoded the slippage for now

    //GET TOKEN BALANCE HERE BEFORE PROCEEDING
    const connection = new Connection(config.solMainnet);
    const walletAddress = new PublicKey(user.solanaWallets[0].address);
    const tokenMintAddress = new PublicKey(tokenAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { mint: tokenMintAddress }
    );

    if (tokenAccounts.value.length === 0) {
      console.log('No balance - user has no token account');
      return ctx.reply(`❌ You do not hold any ${symbol} tokens in your wallet.`);
    } else {
      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      console.log(`USDC Balance: ${balance}`);
      userTokenBalance = Math.floor(balance * 10 ** decimals); // ‼ convert to smallest unit

      console.log(`User token balance in smallest unit: ${userTokenBalance}`);
    }

    //calculate how much the user wants to sell in percentage of their balance.
    const amountToSell = Math.floor((percentageToSell / 100) * userTokenBalance);
    console.log(`User wants to sell ${percentageToSell}% which is ${amountToSell} ${symbol}`);



    await ctx.answerCbQuery("Fetching order details...");

    const order = await getSellOrder(
      ctx,
      tokenAddress,
      Number(amountToSell), //formatted amount in smallest unit
      slippageBps,
    );
    console.log("Order response in sellcommand:", order);
    if (!order.success) {
      console.log("Order error in sellCommand:", order.error || '');
      if (order.error === "Invalid outputMint") {
        return ctx.reply("This token is not supported for trading at the moment, possibly due to low liquidity.");
      }
      if (order.error === "Insufficient funds") {
        return ctx.reply("You have insufficient SOL to complete this transaction. Please deposit SOL into your wallet.");
      }
      return ctx.reply(`Error fetching order: ${order.error}`);
    }

    clearTradeState(tradeId);

    // Store the order details for later execution
    setOrderState(ctx.from.id, {
      transactionBase64: order.transactionBase64,
      requestId: order.requestId,
    });

    // The outAmount is in the smallest unit of the token.
    // We need to know the token's decimals to display the correct amount.
    // For now, we display the raw amount with formatting.
    const formattedOutAmount = (order.outAmount / 1e9).toFixed(6);

    const feeInSol = order.fee / 1e9;

    const orderDetails = `
<b>Order Details</b>
-------------------
<b>${symbol} Address:</b> <code>${tokenAddress}</code>

<b>Amount:</b> ${userTokenBalance / 10 ** decimals} ${symbol}
<b>Slippage:</b> ${slippageBps / 100}%
-------------------
<b>You will receive approximately:</b> ${formattedOutAmount} SOL

<b>Price Impact:</b> ${order.priceImpact.toFixed(2)}%
<b>Fee:</b> ${feeInSol.toFixed(9)} SOL
`;

    await ctx.replyWithHTML(
      orderDetails,
      Markup.inlineKeyboard([
        Markup.button.callback("Approve", `approve_sell:${order.requestId}:${decimals}:${symbol}`),
        Markup.button.callback("Decline", "decline_sell"),
      ])
    );
  } catch (error) {
    console.error("Error in handleBuy:", error);
    await ctx.reply("An unexpected error occurred. Please try again later.");
  }
}