import { ethers } from 'ethers';
import { Context } from 'telegraf';
import getUser from '@modules/users/getUserInfo';
import { config } from '@core/config/config';
import { decryptPrivateKey } from '@shared/utils/encryption';

// RPC URLs for supported chains
const CHAIN_RPC_URLS = {
  CELO: 'https://forno.celo.org',
  BASE: 'https://base-rpc.publicnode.com',
  OPTIMISM: 'https://mainnet.optimism.io',
  POLYGON: 'https://polygon-rpc.com',
  ARBITRUM: 'https://arb1.arbitrum.io/rpc'
};

// Chain IDs
const CHAIN_IDS = {
  CELO: 42220,
  BASE: 8453,
  OPTIMISM: 10,
  POLYGON: 137,
  ARBITRUM: 42161
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

// ERC-20 ABI (minimal - balanceOf and transfer functions)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

/**
 * Get ETH balance for an EVM wallet address on a specific chain
 */
async function getEthBalance(walletAddress: string, chain: keyof typeof CHAIN_RPC_URLS): Promise<string> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const balanceWei = await provider.getBalance(walletAddress);
    const balanceEth = ethers.formatEther(balanceWei);

    return balanceEth;
  } catch (error) {
    console.error(`Error fetching ETH balance on ${chain}:`, error);
    throw error;
  }
}

/**
 * Get ERC-20 token balance (USDC/USDT) for an EVM wallet address
 */
async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chain: keyof typeof CHAIN_RPC_URLS,
  decimals: number = 6
): Promise<string> {
  try {
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    return formattedBalance;
  } catch (error) {
    console.error(`Error fetching token balance on ${chain}:`, error);
    throw error;
  }
}

/**
 * Withdraw ETH to NGN - Execute actual ETH transfer
 */
export async function withdrawETHToNGN(ctx: Context, toAddress: string, amount: number, chain: keyof typeof CHAIN_RPC_URLS = 'BASE') {
  console.log("=== Initiating ETH withdrawal ===");

  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return { success: false, error: 'Unable to identify account' };
  }

  console.log(`User: ${username} (${telegramId})`);
  console.log(`Target chain: ${chain}`);
  console.log(`Recipient: ${toAddress}`);
  console.log(`Amount: ${amount} ETH`);

  // Get user from database
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  console.log(`User found in database: ${user.username}`);

  // Validate EVM wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    console.log("❌ No EVM wallet found for user");
    await ctx.reply(
      "❌ No EVM wallet found. Please create an EVM wallet first."
    );
    return { success: false, error: 'No EVM wallet found' };
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet private key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet private key not found' };
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`From wallet: ${wallet.address}`);
    console.log(`Chain: ${chain} (ID: ${CHAIN_IDS[chain]})`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Check sender's ETH balance
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    console.log(`Current ETH balance: ${ethBalance} ETH`);

    // 4. Estimate gas for the transaction
    const amountWei = ethers.parseEther(amount.toString());

    const gasEstimate = await provider.estimateGas({
      to: toAddress,
      value: amountWei,
    });

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGasCost = gasEstimate * gasPrice;
    const estimatedGasCostEth = ethers.formatEther(estimatedGasCost);

    console.log(`Estimated gas: ${gasEstimate.toString()} units`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated gas cost: ${estimatedGasCostEth} ETH`);

    // 5. Verify sufficient balance (amount + gas)
    const totalNeeded = amountWei + estimatedGasCost;

    if (balance < totalNeeded) {
      const totalNeededEth = ethers.formatEther(totalNeeded);
      return {
        success: false,
        error: `Insufficient balance. You have: ${ethBalance} ETH, You need: ${totalNeededEth} ETH (including gas: ${estimatedGasCostEth} ETH)`
      };
    }

    // 6. Create and send transaction
    console.log('\n📤 Sending ETH transaction...');
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
      gasLimit: gasEstimate,
      gasPrice: gasPrice,
    });

    console.log(`Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    // 7. Wait for confirmation
    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`Gas used: ${receipt?.gasUsed.toString()} units`);
    console.log(`View on explorer: https://basescan.org/tx/${tx.hash}`); // Update based on chain

    // 8. Check new balance
    const newBalance = await provider.getBalance(wallet.address);
    console.log(`New ETH balance: ${ethers.formatEther(newBalance)} ETH`);

    console.log('\n=== ETH withdrawal completed successfully ===\n');

    return {
      success: true,
      signature: tx.hash,
      fromAddress: wallet.address,
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://basescan.org/tx/${tx.hash}` // Update based on chain
    };

  } catch (error) {
    console.error('❌ ETH transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Withdraw USDC to NGN - Execute actual USDC (ERC-20) transfer
 */
export async function withdrawUSDCToNGN(ctx: Context, toAddress: string, amount: number, chain: keyof typeof CHAIN_RPC_URLS = 'BASE') {
  console.log("=== Initiating USDC withdrawal ===");

  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return { success: false, error: 'Unable to identify account' };
  }

  console.log(`User: ${username} (${telegramId})`);
  console.log(`Target chain: ${chain}`);
  console.log(`Recipient: ${toAddress}`);
  console.log(`Amount: ${amount} USDC`);

  // Get user from database
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  console.log(`User found in database: ${user.username}`);

  // Validate EVM wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    console.log("❌ No EVM wallet found for user");
    await ctx.reply(
      "❌ No EVM wallet found. Please create an EVM wallet first."
    );
    return { success: false, error: 'No EVM wallet found' };
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet private key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet private key not found' };
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // Get USDC token address for the chain
    const tokenAddress = TOKEN_ADDRESSES[chain]?.USDC;

    if (!tokenAddress) {
      console.log(`❌ USDC not supported on ${chain}`);
      await ctx.reply(`❌ USDC is not supported on ${chain} chain.`);
      return { success: false, error: `USDC not supported on ${chain}` };
    }

    console.log(`USDC Contract Address: ${tokenAddress}`);

    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`From wallet: ${wallet.address}`);
    console.log(`Chain: ${chain} (ID: ${CHAIN_IDS[chain]})`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Create USDC contract instance
    const usdcContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    // 4. Check sender's USDC balance
    const balance = await usdcContract.balanceOf(wallet.address);
    const decimals = 6; // USDC has 6 decimals
    const usdcBalance = ethers.formatUnits(balance, decimals);
    console.log(`Current USDC balance: ${usdcBalance} USDC`);

    // 5. Convert amount to smallest unit (with 6 decimals for USDC)
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    // Check sufficient USDC balance
    if (balance < amountInSmallestUnit) {
      return {
        success: false,
        error: `Insufficient USDC balance. You have: ${usdcBalance} USDC, You need: ${amount} USDC`
      };
    }

    // 6. Check ETH balance for gas
    const ethBalance = await provider.getBalance(wallet.address);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH balance (for gas): ${ethBalanceFormatted} ETH`);

    // 7. Estimate gas for the token transfer
    const gasEstimate = await usdcContract.transfer.estimateGas(toAddress, amountInSmallestUnit);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGasCost = gasEstimate * gasPrice;
    const estimatedGasCostEth = ethers.formatEther(estimatedGasCost);

    console.log(`Estimated gas: ${gasEstimate.toString()} units`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated gas cost: ${estimatedGasCostEth} ETH`);

    // Check sufficient ETH for gas
    if (ethBalance < estimatedGasCost) {
      return {
        success: false,
        error: `Insufficient ETH for gas fees. You have: ${ethBalanceFormatted} ETH, You need: ${estimatedGasCostEth} ETH for gas`
      };
    }

    // 8. Execute token transfer
    console.log('\n📤 Sending USDC transaction...');
    const tx = await usdcContract.transfer(toAddress, amountInSmallestUnit, {
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });

    console.log(`Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    // 9. Wait for confirmation
    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`Gas used: ${receipt?.gasUsed.toString()} units`);
    console.log(`View on explorer: https://basescan.org/tx/${tx.hash}`);

    // 10. Check new balances
    const newBalance = await usdcContract.balanceOf(wallet.address);
    console.log(`New USDC balance: ${ethers.formatUnits(newBalance, decimals)} USDC`);

    const newEthBalance = await provider.getBalance(wallet.address);
    console.log(`New ETH balance: ${ethers.formatEther(newEthBalance)} ETH`);

    console.log('\n=== USDC withdrawal completed successfully ===\n');

    return {
      success: true,
      signature: tx.hash,
      fromAddress: wallet.address,
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://basescan.org/tx/${tx.hash}`
    };

  } catch (error) {
    console.error('❌ USDC transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Withdraw USDT to NGN - Execute actual USDT (ERC-20) transfer
 */
export async function withdrawUSDTToNGN(ctx: Context, toAddress: string, amount: number, chain: keyof typeof CHAIN_RPC_URLS = 'BASE') {
  console.log("=== Initiating USDT withdrawal ===");

  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return { success: false, error: 'Unable to identify account' };
  }

  console.log(`User: ${username} (${telegramId})`);
  console.log(`Target chain: ${chain}`);
  console.log(`Recipient: ${toAddress}`);
  console.log(`Amount: ${amount} USDT`);

  // Get user from database
  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  console.log(`User found in database: ${user.username}`);

  // Validate EVM wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    console.log("❌ No EVM wallet found for user");
    await ctx.reply(
      "❌ No EVM wallet found. Please create an EVM wallet first."
    );
    return { success: false, error: 'No EVM wallet found' };
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet private key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet private key not found' };
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // Get USDT token address for the chain
    const tokenAddress = TOKEN_ADDRESSES[chain]?.USDT;

    if (!tokenAddress) {
      console.log(`❌ USDT not supported on ${chain}`);
      await ctx.reply(`❌ USDT is not supported on ${chain} chain.`);
      return { success: false, error: `USDT not supported on ${chain}` };
    }

    console.log(`USDT Contract Address: ${tokenAddress}`);

    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`From wallet: ${wallet.address}`);
    console.log(`Chain: ${chain} (ID: ${CHAIN_IDS[chain]})`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Create USDT contract instance
    const usdtContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    // 4. Check sender's USDT balance
    const balance = await usdtContract.balanceOf(wallet.address);
    const decimals = 6; // USDT has 6 decimals
    const usdtBalance = ethers.formatUnits(balance, decimals);
    console.log(`Current USDT balance: ${usdtBalance} USDT`);

    // 5. Convert amount to smallest unit (with 6 decimals for USDT)
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    // Check sufficient USDT balance
    if (balance < amountInSmallestUnit) {
      return {
        success: false,
        error: `Insufficient USDT balance. You have: ${usdtBalance} USDT, You need: ${amount} USDT`
      };
    }

    // 6. Check ETH balance for gas
    const ethBalance = await provider.getBalance(wallet.address);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH balance (for gas): ${ethBalanceFormatted} ETH`);

    // 7. Estimate gas for the token transfer
    const gasEstimate = await usdtContract.transfer.estimateGas(toAddress, amountInSmallestUnit);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGasCost = gasEstimate * gasPrice;
    const estimatedGasCostEth = ethers.formatEther(estimatedGasCost);

    console.log(`Estimated gas: ${gasEstimate.toString()} units`);
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Estimated gas cost: ${estimatedGasCostEth} ETH`);

    // Check sufficient ETH for gas
    if (ethBalance < estimatedGasCost) {
      return {
        success: false,
        error: `Insufficient ETH for gas fees. You have: ${ethBalanceFormatted} ETH, You need: ${estimatedGasCostEth} ETH for gas`
      };
    }

    // 8. Execute token transfer
    console.log('\n📤 Sending USDT transaction...');
    const tx = await usdtContract.transfer(toAddress, amountInSmallestUnit, {
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });

    console.log(`Transaction hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    // 9. Wait for confirmation
    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`Gas used: ${receipt?.gasUsed.toString()} units`);
    console.log(`View on explorer: https://basescan.org/tx/${tx.hash}`);

    // 10. Check new balances
    const newBalance = await usdtContract.balanceOf(wallet.address);
    console.log(`New USDT balance: ${ethers.formatUnits(newBalance, decimals)} USDT`);

    const newEthBalance = await provider.getBalance(wallet.address);
    console.log(`New ETH balance: ${ethers.formatEther(newEthBalance)} ETH`);

    console.log('\n=== USDT withdrawal completed successfully ===\n');

    return {
      success: true,
      signature: tx.hash,
      fromAddress: wallet.address,
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://basescan.org/tx/${tx.hash}`
    };

  } catch (error) {
    console.error('❌ USDT transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
