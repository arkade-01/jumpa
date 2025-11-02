import { Context } from "telegraf";
import User from "@database/models/user";

export async function getOrder(ctx: Context, tokenAddress: string, amount: number, slippageBps: number, buyerAddress: string) {
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

  const inputAmount = amount * 1e9; // Convert to lamports
  const slippage = 200; //2% slippage. Hardcoded for now.
  const takerAddress = user.solanaWallets[0].address;

  if (!takerAddress) {
    return {
      success: false,
      error: "Buyer wallet address not found.",
    };
  }

  const orderResponse = await fetch(
    `https://lite-api.jup.ag/ultra/v1/order` +
    `?inputMint=So11111111111111111111111111111111111111112` +
    `&outputMint=${tokenAddress}` +
    `&amount=${inputAmount}` +
    `&slippage=${slippage}` +
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



//sample data returned
// {
//   inAmount: '100',
//     outAmount: '35406',
//       otherAmountThreshold: '33965',
//         swapMode: 'ExactIn',
//           slippageBps: 407,
//             priceImpactPct: '-0.0076285326470339355',
//               routePlan: [{ swapInfo: [Object], percent: 100, bps: 10000 }],
//                 feeMint: 'So11111111111111111111111111111111111111112',
//                   feeBps: 10,
//                     platformFee: { feeBps: 10 },
//   taker: '6vLdn7HwwFCMh2p33AvprFdfoq97DHVzwLHyULoH8WMR',
//     gasless: false,
//       signatureFeeLamports: 5000,
//         signatureFeePayer: '6vLdn7HwwFCMh2p33AvprFdfoq97DHVzwLHyULoH8WMR',
//           prioritizationFeeLamports: 89057,
//             prioritizationFeePayer: '6vLdn7HwwFCMh2p33AvprFdfoq97DHVzwLHyULoH8WMR',
//               rentFeeLamports: 2039280,
//                 rentFeePayer: '6vLdn7HwwFCMh2p33AvprFdfoq97DHVzwLHyULoH8WMR',
//                   transaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAIEVf0avjP3UxX4mzY8Kp/ReEQXgZ/mDRfNY95kDZpxiLMHBVFi5brzZyvNonKFFn2VVL0jGgOpx2vGgZJVJwh99M6zpDvXvqqYhZu4GAkOZRiIo9CdeATJa6uhutzDUTcL1qqErOXcLJuz3yO6AvXG7SPnq17gD3ZSZRrYIxZZ8PBcgyoeqmD70f4xOq01NqQTRSPeYWOAz0WDJozF+vDtPie0z3FPJzx2o8fpLVxXVVowwpbK2UOX2Oy3ORrERxaYMkDD8Co+rtYyvwmKWDxNCKzlS3t0TFJB/1K1AwjiOLs1FMk4rStIc1Dak3COB6tZxhGYeZTGGPc4G+B1IraJP7dU1oASrHYG7SL6Y7FddFK4KtVmj6cfd+FSpI/eagolAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj8KVnGM4ztY7NmoOq69dDdGe2Rt7U14fjYpEKdCstv+MlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WQMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAAsnDWf6mMUc8CEwUTWJYrrzV0K+1ZydlEXpwNDIXHzZEEedVb8jHAbu50xW7OaBUH/bGy3qP0jlECsc2iVrwTjwTp4S+8hOgmyTLM6eJkDM4VWQwcYnOwklcIujuFILC8Bt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKkzaT6LVgpEpJN3qRu3OH42y7ek1pJtU3IUCjpcsmqDogcMAAUCFIoBAAwACQNGeA0AAAAAAAkCAAYMAgAAAFQeHwAAAAAADgUGABQQCQmT8Xtk9ISudv8LBgADAAoJEAEBDh8ABgMUChAQDhIOEQ8IDwcFBgMKFAQPABAQDQ8BAg4TJ7tk+swxxK8UZAAAAAAAAABOigAAAAAAAJcBCgAAAAEAAAAmECcAARADBgAAAQkBKb+VBypPvwTfcXWT5zi8zCEnKBXCRxqA2fn1VbDUhCUBJgMAARc=',
//                     mode: 'ultra',
//                       inputMint: 'So11111111111111111111111111111111111111112',
//                         outputMint: 'AgBPkSqL64uQ58kka9LqcxyuNk4erExTfM779YYJpump',
//                           swapType: 'aggregator',
//                             router: 'iris',
//                               requestId: '019a12d7-868b-75c9-bdf7-84bed1aedf6e',
//                                 inUsdValue: 0.000018992160199521197,
//                                   outUsdValue: 0.00001884727788540145,
//                                     priceImpact: -0.7628532647033935,
//                                       swapUsdValue: 0.000018992160199521197,
//                                         totalTime: 481
// }
// route info[
//   {
//     swapInfo: {
//       ammKey: 'FtxpRvYDm8zAcw69DkfdYvCt3Ygp7kxWvbGBqn71AfX9',
//       label: 'Meteora DLMM',
//       inputMint: 'So11111111111111111111111111111111111111112',
//       outputMint: 'AgBPkSqL64uQ58kka9LqcxyuNk4erExTfM779YYJpump',
//       inAmount: '100',
//       outAmount: '35441',
//       feeAmount: '1',
//       feeMint: 'So11111111111111111111111111111111111111112'
//     },
//     percent: 100,
//     bps: 10000
//   }
// ]