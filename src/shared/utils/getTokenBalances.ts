import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "@core/config/config";

const connection = new Connection(config.solMainnet, 'confirmed');

// Token mint addresses on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

/**
 * Get USDC balance for a Solana wallet address
 * @param walletAddress - The Solana wallet address
 * @returns USDC balance as a number
 */
export async function getUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { mint: USDC_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return 0; // No USDC token account found
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return balanceInfo.uiAmount || 0;
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    return 0;
  }
}

/**
 * Get USDT balance for a Solana wallet address
 * @param walletAddress - The Solana wallet address
 * @returns USDT balance as a number
 */
export async function getUSDTBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { mint: USDT_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return 0; // No USDT token account found
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return balanceInfo.uiAmount || 0;
  } catch (error) {
    console.error('Error fetching USDT balance:', error);
    return 0;
  }
}

/**
 * Get all SPL token balances (USDC and USDT) for a wallet
 * @param walletAddress - The Solana wallet address
 * @returns Object containing USDC and USDT balances
 */
export async function getAllTokenBalances(walletAddress: string): Promise<{
  usdc: number;
  usdt: number;
}> {
  try {
    const [usdc, usdt] = await Promise.all([
      getUSDCBalance(walletAddress),
      getUSDTBalance(walletAddress)
    ]);

    return { usdc, usdt };
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return { usdc: 0, usdt: 0 };
  }
}
