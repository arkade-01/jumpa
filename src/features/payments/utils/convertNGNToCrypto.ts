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
  currency: 'SOL' | 'USDC' | 'USDT' | 'ETH' | 'CELO',
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
      cryptoAmount = usdAmount * rate.data.sell.SOL;
    } else if (currency === 'ETH') {
      cryptoAmount = usdAmount * rate.data.sell.ETH;
    } else if (currency === 'CELO') {
      cryptoAmount = usdAmount * rate.data.sell.CELO;
    } else if (currency === 'USDC' || currency === 'USDT') {
      cryptoAmount = usdAmount;
    } else {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    console.log(`[Currency Conversion] $${usdAmount.toFixed(2)} = ${cryptoAmount.toFixed(6)} ${currency}`);

    // Limit decimal places to prevent ethers.js "too many decimals" error
    // Most tokens support up to 18 decimals, but we limit to 6 for practical amounts
    const limitedAmount = parseFloat(cryptoAmount.toFixed(6));

    console.log(`[Currency Conversion] Final amount (limited to 6 decimals): ${limitedAmount} ${currency}`);

    return limitedAmount;
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
  } else if (chain === 'CELO') {
    return ['CELO', 'ETH', 'USDC', 'USDT'];
  } else if (chain === 'BASE') {
    return ['ETH', 'USDC', 'USDT'];
  }
  return [];
}

/**
 * Converts cryptocurrency amount to NGN using current exchange rates
 * @param cryptoAmount - Amount in cryptocurrency
 * @param currency - Cryptocurrency (SOL, USDC, USDT, ETH)
 * @param chain - Blockchain (SOLANA, BASE, CELO)
 * @returns NGN amount
 */
export async function convertCryptoToNGN(
  cryptoAmount: number,
  currency: 'SOL' | 'USDC' | 'USDT' | 'ETH' | 'CELO',
  chain: 'SOLANA' | 'BASE' | 'CELO'
): Promise<number> {
  try {
    const rateUrl = config.paymentRateUrl;

    if (!rateUrl) {
      throw new Error('Exchange rate URL not configured');
    }

    const exchangeRateResponse = await fetch(rateUrl);
    const rate = await exchangeRateResponse.json();

    // Convert crypto to USD first
    let usdAmount: number;

    if (currency === 'SOL') {
      usdAmount = cryptoAmount / rate.data.sell.SOL;
    } else if (currency === 'ETH') {
      usdAmount = cryptoAmount / rate.data.sell.ETH;
    } else if (currency === 'CELO') {
      usdAmount = cryptoAmount / rate.data.sell.CELO; // will throw an error since our LP doesnt support CELO token
    } else if (currency === 'USDC' || currency === 'USDT') {
      usdAmount = cryptoAmount;
    } else {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    // Convert USD to NGN
    const ngnAmount = usdAmount * rate.data.sell.NGN;

    return Math.round(ngnAmount * 100) / 100; // Round to 2 decimal places
  } catch (error: any) {
    console.error('[Currency Conversion] Error:', error);
    throw new Error(`Failed to convert currency: ${error.message}`);
  }
}
