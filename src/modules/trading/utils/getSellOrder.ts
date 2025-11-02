import { Context } from "telegraf";
import User from "@database/models/user";

export async function getSellOrder(ctx: Context, tokenAddress: string, amount: number, slippageBps: number) {
  if (!ctx.from) {
    return {
      success: false,
      error: "User not identified",
    };
  }
  const user = await User.findOne({ telegram_id: ctx.from.id });
  if (!user) {
    return {
      success: false,
      error: "User not found. Please /start to create a wallet.",
    };
  }
  const takerAddress = user.solanaWallets[0].address;

  if (!takerAddress) {
    return {
      success: false,
      error: "Buyer wallet address not found.",
    };
  }

  //set SOL as the output mint 
  const orderResponse = await fetch(
    `https://lite-api.jup.ag/ultra/v1/order` +
    `?inputMint=${tokenAddress}` +
    `&outputMint=So11111111111111111111111111111111111111112` +
    `&amount=${amount}` +
    `&slippage=${slippageBps}` +
    `&taker=${takerAddress}`,
  );
  const orderData = await orderResponse.json();
  // console.log("order data in getOrder", orderData);
  // console.log("route info", orderData.routePlan);

  if (orderData.error) {
    console.log(orderData.error);
    return {
      success: false,
      error: orderData.error,
    };
  }

  return {
    requestId: orderData.requestId,
    transactionBase64: orderData.transaction,
    success: true,
    inAmount: orderData.inAmount,
    outAmount: orderData.outAmount,
    inUsdValue: orderData.inUsdValue,
    outUsdValue: orderData.outUsdValue,
    priceImpact: orderData.priceImpact,
    swapUsdValue: orderData.swapUsdValue,
    fee: orderData.routePlan[0].swapInfo.feeAmount,
    routeInfo: orderData.routePlan,
  };
}