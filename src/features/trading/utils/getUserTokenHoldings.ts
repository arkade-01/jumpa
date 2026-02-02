import Trade from "@core/database/models/Trade";
import { getTokenPriceData } from "@shared/utils/getTokenPriceData";

export interface TokenHolding {
  tokenAddress: string;
  symbol: string;
  netAmount: number;
  chain: string;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number; // USD per token
  // Live price data
  currentPriceUsd?: number;
  currentValueUsd?: number;
  currentValueSol?: number;
  profitLossPercent?: number;
  priceChange5m?: number;
  priceChange15m?: number;
  priceChange24h?: number;
  marketCap?: number;
}

/**
 * Get user's token holdings based on their trade history
 * Calculates net position (buys - sells) for each token
 * Only returns tokens with positive net positions
 */
export async function getUserTokenHoldings(
  telegramId: number
): Promise<TokenHolding[]> {
  try {
    const holdings = await Trade.aggregate([
      // Only include successful trades for this user
      { $match: { telegram_id: telegramId, status: "SUCCESS" } },

      // Group by token address
      {
        $group: {
          _id: "$tokenAddress",
          symbol: { $first: "$symbol" },
          chain: { $first: "$chain" },
          totalBought: {
            $sum: {
              $cond: [{ $eq: ["$type", "BUY"] }, "$tokenAmount", 0]
            }
          },
          totalSold: {
            $sum: {
              $cond: [{ $eq: ["$type", "SELL"] }, "$tokenAmount", 0]
            }
          },
          totalBuyValue: {
            $sum: {
              $cond: [{ $eq: ["$type", "BUY"] }, "$amountUsd", 0]
            }
          }
        }
      },

      // Calculate net position and average buy price
      {
        $project: {
          tokenAddress: "$_id",
          symbol: 1,
          chain: 1,
          totalBought: 1,
          totalSold: 1,
          netAmount: { $subtract: ["$totalBought", "$totalSold"] },
          avgBuyPrice: {
            $cond: [
              { $gt: ["$totalBought", 0] },
              { $divide: ["$totalBuyValue", "$totalBought"] },
              0
            ]
          }
        }
      },

      // Only show tokens with positive holdings
      { $match: { netAmount: { $gt: 0 } } },

      // Sort by net amount descending
      { $sort: { netAmount: -1 } }
    ]);

    console.log("User token holdings:", holdings);

    if (holdings.length === 0) {
      return [];
    }

    // Fetch live price data for all tokens
    const tokenAddresses = holdings.map((h: any) => h.tokenAddress);

    // Add SOL address to get SOL price for conversion
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const priceData = await getTokenPriceData([...tokenAddresses, SOL_MINT]);

    // Get SOL price
    const solPriceData = priceData.get(SOL_MINT);
    const solPrice = solPriceData?.currentPriceUsd || 0;

    // Enrich holdings with live price data
    const enrichedHoldings = holdings.map((holding: any) => {
      const price = priceData.get(holding.tokenAddress);

      if (price && price.currentPriceUsd > 0) {
        const currentValueUsd = holding.netAmount * price.currentPriceUsd;
        const profitLossPercent =
          holding.avgBuyPrice > 0
            ? ((price.currentPriceUsd - holding.avgBuyPrice) / holding.avgBuyPrice) * 100
            : 0;

        return {
          ...holding,
          currentPriceUsd: price.currentPriceUsd,
          currentValueUsd,
          currentValueSol: solPrice > 0 ? currentValueUsd / solPrice : 0,
          profitLossPercent,
          priceChange5m: price.priceChange5m,
          priceChange15m: price.priceChange15m,
          priceChange24h: price.priceChange24h,
          marketCap: price.marketCap,
        } as TokenHolding;
      }

      // Return holding without live data if price fetch failed
      return holding as TokenHolding;
    });

    return enrichedHoldings;
  } catch (error) {
    console.error("Error fetching user token holdings:", error);
    return [];
  }
}
