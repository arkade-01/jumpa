import { config } from '@core/config/environment';

/**
 * Converts NGN amount to cryptocurrency amount using current exchange rates
 * @param ngnAmount - Amount in Nigerian Naira
 * @param currency - Target cryptocurrency (SOL, USDC, USDT, ETH)
 * @param chain - Blockchain (SOLANA, BASE, CELO)
 * @returns Crypto amount
 */
export async function convertNGNToCrypto(
  ngnAmount: number,
  currency: 'SOL' | 'USDC' | 'USDT' | 'ETH',
  chain: 'SOLANA' | 'BASE' | 'CELO'
): Promise<number> {
  try {
    const rateUrl = config.paymentRateUrl;

    if (!rateUrl) {
      throw new Error('Exchange rate URL not configured');
    }

    console.log(`[Currency Conversion] Converting ₦${ngnAmount} to ${currency} on ${chain}`);

    const exchangeRateResponse = await fetch(rateUrl);
    const rate = await exchangeRateResponse.json();

    console.log('[Currency Conversion] Exchange rates:', rate.data.sell);

    // Convert NGN to USD first
    const usdAmount = ngnAmount / rate.data.sell.NGN;
    console.log(`[Currency Conversion] ₦${ngnAmount} = $${usdAmount.toFixed(2)}`);

    // Convert USD to crypto
    let cryptoAmount: number;

    if (currency === 'SOL') {
      // rate.data.sell.SOL is SOL per USD, so multiply
      cryptoAmount = usdAmount * rate.data.sell.SOL;
    } else if (currency === 'ETH') {
      // rate.data.sell.ETH is ETH per USD, so multiply
      cryptoAmount = usdAmount * rate.data.sell.ETH;
    } else if (currency === 'USDC' || currency === 'USDT') {
      // USDC and USDT are stablecoins, 1:1 with USD
      cryptoAmount = usdAmount;
    } else {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    console.log(`[Currency Conversion] $${usdAmount.toFixed(2)} = ${cryptoAmount.toFixed(6)} ${currency}`);

    return cryptoAmount;
  } catch (error: any) {
    console.error('[Currency Conversion] Error:', error);
    throw new Error(`Failed to convert currency: ${error.message}`);
  }
}

/**
 * Get available currencies for a specific chain
 * @param chain - Blockchain (SOLANA, BASE, CELO)
 * @returns Array of supported currencies
 */
export function getCurrenciesForChain(chain: 'SOLANA' | 'BASE' | 'CELO'): string[] {
  if (chain === 'SOLANA') {
    return ['SOL', 'USDC', 'USDT'];
  } else if (chain === 'BASE' || chain === 'CELO') {
    return ['ETH', 'USDC', 'USDT'];
  }
  return [];
}
