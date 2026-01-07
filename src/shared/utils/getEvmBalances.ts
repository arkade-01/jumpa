import { ethers } from 'ethers';
import User from "@core/database/models/user";

// RPC URLs for supported chains
const CHAIN_RPC_URLS = {
  CELO: 'https://forno.celo.org',
  BASE: 'https://base-rpc.publicnode.com',
};

// Token contract addresses
const TOKEN_ADDRESSES = {
  CELO: {
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e'
  },
  BASE: {
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
  }
};

// ERC-20 ABI (minimal - balanceOf function)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const CACHE_DURATION = 60 * 1000; // 60 seconds(1 minute)

export type ChainName = 'CELO' | 'BASE';

export interface ChainBalances {
  eth: number;
  usdc: number;
  usdt: number;
}

export interface AllChainBalances {
  CELO: ChainBalances;
  BASE: ChainBalances;
}

/**
 * Get ETH balance for an address on a specific chain
 */
async function getEthBalance(walletAddress: string, chain: ChainName): Promise<number> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const balanceWei = await provider.getBalance(walletAddress);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));

    return balanceEth;
  } catch (error) {
    console.error(`Error fetching ETH balance on ${chain}:`, error);
    return 0;
  }
}

/**
 * Get ERC-20 token balance (USDC/USDT) for an address
 */
async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chain: ChainName,
  decimals: number = 6
): Promise<number> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));

    return formattedBalance;
  } catch (error) {
    console.error(`Error fetching token balance on ${chain}:`, error);
    return 0;
  }
}

/**
 * Get all balances (ETH, USDC, USDT) for a wallet on a specific chain
 */
async function getChainBalances(walletAddress: string, chain: ChainName): Promise<ChainBalances> {
  try {
    const [eth, usdc, usdt] = await Promise.all([
      getEthBalance(walletAddress, chain),
      getTokenBalance(walletAddress, TOKEN_ADDRESSES[chain].USDC, chain, 6),
      getTokenBalance(walletAddress, TOKEN_ADDRESSES[chain].USDT, chain, 6)
    ]);

    return { eth, usdc, usdt };
  } catch (error) {
    console.error(`Error fetching balances on ${chain}:`, error);
    return { eth: 0, usdc: 0, usdt: 0 };
  }
}

/**
 * Get all balances across Celo and Base chains with caching
 */
export async function getAllEvmBalances(
  walletAddress: string,
  forceRefresh: boolean = false
): Promise<AllChainBalances> {
  try {
    // Find user with this wallet address
    const user = await User.findOne({
      'evmWallets.address': walletAddress
    }).exec();

    if (!user) {
      console.warn(`User not found for EVM wallet address: ${walletAddress}`);
      return {
        CELO: { eth: 0, usdc: 0, usdt: 0 },
        BASE: { eth: 0, usdc: 0, usdt: 0 }
      };
    }

    const walletIndex = user.evmWallets.findIndex(w => w.address === walletAddress);

    if (walletIndex === -1) {
      return {
        CELO: { eth: 0, usdc: 0, usdt: 0 },
        BASE: { eth: 0, usdc: 0, usdt: 0 }
      };
    }

    const wallet: any = user.evmWallets[walletIndex]; // Cast to any to access new fields safely if TS complains

    // Check cache
    const now = Date.now();
    const lastUpdated = wallet.last_updated_evm_balance?.getTime() || 0;
    const cacheAge = now - lastUpdated;
    const isCacheValid = cacheAge < CACHE_DURATION && !forceRefresh;

    // Check for existence of data
    const hasData = wallet.celo && wallet.base;

    // Use SWR only if we have data AND we are not forcing a refresh
    if (hasData && !forceRefresh) {
      console.log(`EVM Cache status: ${isCacheValid ? 'Valid' : 'Stale'} (age: ${Math.round(cacheAge / 1000)}s)`);

      // If cache is stale or forced refresh, trigger background update
      if (!isCacheValid) {
        console.log(` <== Triggering background EVM refresh for ${walletAddress} ==>`);
        refreshEvmBalancesInBackground(walletAddress, walletIndex).catch(err =>
          console.error('Background EVM refresh failed:', err)
        );
      } else {
        console.log(`Using valid cached EVM balances for ${walletAddress}`);
      }

      // Return DB data immediately (Stale-While-Revalidate)
      return {
        CELO: {
          eth: wallet.celo?.eth || 0,
          usdc: wallet.celo?.usdc || 0,
          usdt: wallet.celo?.usdt || 0
        },
        BASE: {
          eth: wallet.base?.eth || 0,
          usdc: wallet.base?.usdc || 0,
          usdt: wallet.base?.usdt || 0
        }
      };
    }

    // No cached data found (first time run) -> Must wait for fetch
    console.log(`No cached data found. Fetching fresh EVM balances for ${walletAddress}...`);
    const [celoBalances, baseBalances] = await refreshEvmBalances(walletAddress, walletIndex);

    return {
      CELO: celoBalances,
      BASE: baseBalances
    };

  } catch (error) {
    console.error('Error in getAllEvmBalances:', error);

    // Fallback to cache if available
    try {
      const user = await User.findOne({ 'evmWallets.address': walletAddress });
      if (user) {
        const wallet: any = user.evmWallets.find(w => w.address === walletAddress);
        if (wallet) {
          console.log('Returning cached EVM balances after error');
          return {
            CELO: wallet.celo || { eth: 0, usdc: 0, usdt: 0 },
            BASE: wallet.base || { eth: 0, usdc: 0, usdt: 0 }
          };
        }
      }
    } catch (e) { /* ignore */ }

    return {
      CELO: { eth: 0, usdc: 0, usdt: 0 },
      BASE: { eth: 0, usdc: 0, usdt: 0 }
    };
  }
}

/**
 * Update balances in the database and return the new values
 */
async function refreshEvmBalances(walletAddress: string, walletIndex: number): Promise<[ChainBalances, ChainBalances]> {
  const [celoBalances, baseBalances] = await Promise.all([
    getChainBalances(walletAddress, 'CELO'),
    getChainBalances(walletAddress, 'BASE')
  ]);

  // Update DB
  await User.findOneAndUpdate(
    { 'evmWallets.address': walletAddress },
    {
      $set: {
        [`evmWallets.${walletIndex}.celo`]: celoBalances,
        [`evmWallets.${walletIndex}.base`]: baseBalances,
        [`evmWallets.${walletIndex}.last_updated_evm_balance`]: new Date()
      }
    },
    { new: true }
  ).exec();

  console.log(`EVM balances synced for ${walletAddress}`);
  return [celoBalances, baseBalances];
}

/**
 * Wrapper for background execution
 */
async function refreshEvmBalancesInBackground(walletAddress: string, walletIndex: number): Promise<void> {
  await refreshEvmBalances(walletAddress, walletIndex);
}
