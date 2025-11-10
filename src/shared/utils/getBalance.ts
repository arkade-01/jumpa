import { PublicKey } from "@solana/web3.js";
import { getSolanaConnection } from "./rpcConfig";
import User from "@database/models/user";

// Cache duration in milliseconds (20 secs) - matches token balance cache
const CACHE_DURATION = 0.2 * 60 * 1000;

/**
 * Get SOL balance for a Solana wallet address with caching support
 * @param walletAddress - The Solana wallet address
 * @param forceRefresh - Force refresh even if cache is valid (default: false)
 * @returns SOL balance as a number
 */
async function getBalance(walletAddress: string, forceRefresh: boolean = false): Promise<number> {
  try {
    // Find user with this wallet address
    const user = await User.findOne({
      'solanaWallets.address': walletAddress
    }).exec();

    if (user) {
      // Find the specific wallet
      const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);

      if (walletIndex !== -1) {
        const wallet = user.solanaWallets[walletIndex];

        // Check if cache is still valid
        const now = Date.now();
        const lastUpdated = wallet.last_updated_balance?.getTime() || 0;
        const cacheAge = now - lastUpdated;
        const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

        if (isCacheValid && wallet.balance !== undefined) {
          console.log(`Using cached SOL balance for ${walletAddress} (age: ${Math.round(cacheAge / 1000)}s)`);
          return wallet.balance;
        }
      }
    }

    // Cache expired, not found, or force refresh - fetch fresh data
    console.log(`Fetching fresh SOL balance for ${walletAddress}`);
    const connection = getSolanaConnection();
    const publicKey = new PublicKey(walletAddress);
    const balanceLamports = await connection.getBalance(publicKey);
    const userBalance = balanceLamports / 1e9;

    // Update cache in database if user exists
    if (user) {
      const walletIndex = user.solanaWallets.findIndex(w => w.address === walletAddress);
      if (walletIndex !== -1) {
        await User.findOneAndUpdate(
          { 'solanaWallets.address': walletAddress },
          {
            $set: {
              [`solanaWallets.${walletIndex}.balance`]: userBalance,
              [`solanaWallets.${walletIndex}.last_updated_balance`]: new Date()
            }
          }
        ).exec();
      }
    }

    return userBalance;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);

    // Try to return cached value on error
    try {
      const user = await User.findOne({
        'solanaWallets.address': walletAddress
      });

      if (user) {
        const wallet = user.solanaWallets.find(w => w.address === walletAddress);
        if (wallet && wallet.balance !== undefined) {
          console.log(`Returning cached SOL balance after error for ${walletAddress}`);
          return wallet.balance;
        }
      }
    } catch (dbError) {
      console.error('Error retrieving cached SOL balance:', dbError);
    }

    throw error;
  }
}

export default getBalance;
// getBalance('8R8eZLAvB5A9QyByszPZ7bVJsBkdAPU1CYmpAHrdBG97')
