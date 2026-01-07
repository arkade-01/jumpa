import { config } from "@core/config/environment";
import User from "@core/database/models/user";

// Use Alchemy RPC endpoint (fallback to solMainnet if not set)
const RPC_ENDPOINT = config.alchemyMainnetRpc;

// Token mint addresses on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Cache duration in milliseconds (0.5 minutes)
const CACHE_DURATION = 0.5 * 60 * 1000;

/**
 * Fetch token accounts by owner via HTTP JSON-RPC
 * @param walletAddress - The Solana wallet address
 * @param mintAddress - The token mint address
 * @returns Token balance or 0 if not found
 */
async function fetchTokenBalanceViaHTTP(walletAddress: string, mintAddress: string): Promise<number> {
  console.log("fetchTokenBalanceViaHTTP gettokenbalance called")
  try {
    const response = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          {
            mint: mintAddress
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    const tokenAccounts = data.result.value;

    if (tokenAccounts.length === 0) {
      return 0; // No token account found
    }

    const balanceInfo = tokenAccounts[0].account.data.parsed.info.tokenAmount;
    return balanceInfo.uiAmount || 0;
  } catch (error) {
    console.error(`Error fetching token balance for mint ${mintAddress}:`, error);
    throw error;
  }
}

/**
 * Get USDC balance for a Solana wallet address (internal - no caching)
 * @param walletAddress - The Solana wallet address
 * @returns USDC balance as a number
 */
async function fetchUSDCBalance(walletAddress: string): Promise<number> {
  return fetchTokenBalanceViaHTTP(walletAddress, USDC_MINT);
}

/**
 * Get USDT balance for a Solana wallet address (internal - no caching)
 * @param walletAddress - The Solana wallet address
 * @returns USDT balance as a number
 */
async function fetchUSDTBalance(walletAddress: string): Promise<number> {
  return fetchTokenBalanceViaHTTP(walletAddress, USDT_MINT);
}

/**
 * Get all SPL token balances (USDC and USDT) for a wallet with caching
 * @param walletAddress - The Solana wallet address
 * @param forceRefresh - Force refresh even if cache is valid (default: false)
 * @returns Object containing USDC and USDT balances
 */
export async function getAllTokenBalances(
  walletAddress: string,
  forceRefresh: boolean = false
): Promise<{
  usdc: number;
  usdt: number;
}> {
  try {
    // Find user with this wallet address - ensure we get fresh data
    const user = await User.findOne({
      'solanaWallets.address': walletAddress
    }).exec();

    if (!user) {
      console.warn(`User not found for wallet address: ${walletAddress}`);
      return { usdc: 0, usdt: 0 };
    }

    // Find the specific wallet
    const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);

    if (walletIndex === -1) {
      console.warn(`Wallet not found in user's wallets: ${walletAddress}`);
      return { usdc: 0, usdt: 0 };
    }

    const wallet = user.solanaWallets[walletIndex];

    // Check if cache is still valid
    const now = Date.now();
    const lastUpdated = wallet.last_updated_token_balance?.getTime() || 0;
    const cacheAge = now - lastUpdated;
    const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

    // Check if we have ever fetched data (not default epoch date)
    const hasData = lastUpdated > 0;

    // Use SWR only if we have data AND we are not forcing a refresh
    if (hasData && !forceRefresh) {
      console.log(`Solana Cache status: ${isCacheValid ? 'Valid' : 'Stale'} (age: ${Math.round(cacheAge / 1000)}s)`);

      if (!isCacheValid) {
        console.log(`Triggering background Solana refresh for ${walletAddress}`);
        refreshTokenBalancesInBackground(walletAddress, walletIndex).catch(err =>
          console.error('Background Solana refresh failed:', err)
        );
      } else {
        console.log(`Using valid cached Solana balances for ${walletAddress}`);
      }

      return {
        usdc: wallet.usdcBalance || 0,
        usdt: wallet.usdtBalance || 0
      };
    }

    // Never fetched before -> Must wait for fetch
    console.log(`No cached Solana data found. Fetching fresh token balances for ${walletAddress}...`);
    const [usdc, usdt] = await refreshTokenBalances(walletAddress, walletIndex);
    return { usdc, usdt };
  } catch (error) {
    console.error('Error fetching token balances:', error);

    // Try to return cached values even if fetch failed
    try {
      const user = await User.findOne({
        'solanaWallets.address': walletAddress
      });

      if (user) {
        const wallet = user.solanaWallets.find(w => w.address === walletAddress);
        if (wallet) {
          console.log(`Returning cached values after fetch error for ${walletAddress}`);
          return {
            usdc: wallet.usdcBalance || 0,
            usdt: wallet.usdtBalance || 0
          };
        }
      }
    } catch (dbError) {
      console.error('Error retrieving cached token balances:', dbError);
    }

    return { usdc: 0, usdt: 0 };
  }
}

/**
 * Update token balances in database and return values
 */
async function refreshTokenBalances(walletAddress: string, walletIndex: number): Promise<[number, number]> {
  const [usdc, usdt] = await Promise.all([
    fetchUSDCBalance(walletAddress),
    fetchUSDTBalance(walletAddress)
  ]);

  // Update DB
  await User.findOneAndUpdate(
    { 'solanaWallets.address': walletAddress },
    {
      $set: {
        [`solanaWallets.${walletIndex}.usdcBalance`]: usdc,
        [`solanaWallets.${walletIndex}.usdtBalance`]: usdt,
        [`solanaWallets.${walletIndex}.last_updated_token_balance`]: new Date()
      }
    },
    { new: true }
  ).exec();

  console.log(`Solana balances synced for ${walletAddress}`);
  return [usdc, usdt];
}

/**
 * Wrapper for background execution
 */
async function refreshTokenBalancesInBackground(walletAddress: string, walletIndex: number): Promise<void> {
  await refreshTokenBalances(walletAddress, walletIndex);
}
