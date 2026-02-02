export interface TokenPriceData {
  address: string;
  currentPriceUsd: number;
  priceChange5m: number;
  priceChange15m: number;
  priceChange24h: number;
  marketCap: number;
  liquidity?: number;
}

/**
 * Fetch live price data for multiple tokens using Jupiter Lite API
 * @param tokenAddresses Array of token mint addresses
 * @returns Map of token address to price data
 */
export async function getTokenPriceData(
  tokenAddresses: string[]
): Promise<Map<string, TokenPriceData>> {
  const priceMap = new Map<string, TokenPriceData>();

  try {
    // Fetch data for each token using Jupiter's search API
    const fetchPromises = tokenAddresses.map(async (address) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(
          `https://lite-api.jup.ag/ultra/v1/search?query=${address}`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`Failed to fetch price for ${address}: ${response.status}`);
          return null;
        }

        const data = await response.json();

        // Jupiter returns an array, get first result which should be exact match
        if (!Array.isArray(data) || data.length === 0) {
          console.warn(`No data found for ${address}`);
          return null;
        }

        const token = data[0];

        console.log(`Price data for ${address}:`, {
          symbol: token.symbol,
          price: token.usdPrice,
          mcap: token.mcap,
          liquidity: token.liquidity
        });

        return {
          address,
          data: {
            address,
            currentPriceUsd: token.usdPrice || 0,
            priceChange5m: token.stats24h?.priceChange5m || 0,
            priceChange15m: token.stats24h?.priceChange15m || 0,
            priceChange24h: token.stats24h?.priceChange || 0,
            marketCap: token.mcap || 0,
            liquidity: token.liquidity || 0,
          } as TokenPriceData
        };
      } catch (error) {
        console.error(`Error fetching price for ${address}:`, error);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);

    // Build map from results
    results.forEach((result) => {
      if (result && result.data) {
        priceMap.set(result.address, result.data);
      }
    });

    return priceMap;
  } catch (error) {
    console.error('Error in getTokenPriceData:', error);
    return priceMap;
  }
}
