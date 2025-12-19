import { ethers } from 'ethers';
import { decryptPrivateKey } from '@shared/utils/encryption';

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

// Explorer URLs for supported chains
const CHAIN_EXPLORERS = {
  CELO: 'https://celoscan.io',
  BASE: 'https://basescan.org',
};

// ERC-20 ABI (minimal - balanceOf and transfer functions)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

/**
 * Execute ETH transfer on EVM chain (pure function - no UI interactions)
 * @param user - User object from database
 * @param toAddress - Recipient address
 * @param amount - Amount in ETH
 * @param chain - Target chain (BASE or CELO)
 * @returns Transaction result
 */
export async function executeETHTransfer(
  user: any,
  toAddress: string,
  amount: number,
  chain: 'BASE' | 'CELO'
) {
  console.log(`[${chain} ETH Transfer] Starting transaction...`);
  console.log(`[${chain} ETH Transfer] To: ${toAddress}, Amount: ${amount} ETH`);

  // Validate wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    throw new Error('No EVM wallet found');
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`[${chain} ETH Transfer] From wallet: ${wallet.address}`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // 3. Check sender's ETH balance
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    console.log(`[${chain} ETH Transfer] Current balance: ${ethBalance} ETH`);

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

    console.log(`[${chain} ETH Transfer] Estimated gas: ${gasEstimate.toString()} units`);
    console.log(`[${chain} ETH Transfer] Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`[${chain} ETH Transfer] Estimated gas cost: ${estimatedGasCostEth} ETH`);

    // 5. Verify sufficient balance (amount + gas)
    const totalNeeded = amountWei + estimatedGasCost;

    if (balance < totalNeeded) {
      const totalNeededEth = ethers.formatEther(totalNeeded);
      throw new Error(
        `Insufficient balance. You have: ${ethBalance} ETH, You need: ${totalNeededEth} ETH (including gas: ${estimatedGasCostEth} ETH)`
      );
    }

    // 6. Create and send transaction
    console.log(`[${chain} ETH Transfer] Sending transaction...`);
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
    });

    console.log(`[${chain} ETH Transfer] Transaction sent: ${tx.hash}`);
    console.log(`[${chain} ETH Transfer] Waiting for confirmation...`);

    const receipt = await tx.wait();

    console.log(`[${chain} ETH Transfer] ✅ Transfer successful!`);
    console.log(`[${chain} ETH Transfer] Block: ${receipt.blockNumber}`);

    return {
      success: true,
      signature: receipt.hash,
      fromAddress: wallet.address,
      toAddress,
      amount,
      explorerUrl: `${CHAIN_EXPLORERS[chain]}/tx/${receipt.hash}`
    };

  } catch (error: any) {
    console.error(`[${chain} ETH Transfer] ❌ Transfer failed:`, error);
    throw error;
  }
}

/**
 * Execute USDC transfer on EVM chain (pure function)
 * @param user - User object from database
 * @param toAddress - Recipient address
 * @param amount - Amount in USDC
 * @param chain - Target chain (BASE or CELO)
 * @returns Transaction result
 */
export async function executeUSDCTransferEVM(
  user: any,
  toAddress: string,
  amount: number,
  chain: 'BASE' | 'CELO'
) {
  console.log(`[${chain} USDC Transfer] Starting transaction...`);
  console.log(`[${chain} USDC Transfer] To: ${toAddress}, Amount: ${amount} USDC`);

  // Validate wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    throw new Error('No EVM wallet found');
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`[${chain} USDC Transfer] From wallet: ${wallet.address}`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // 3. Setup token contract
    const tokenAddress = TOKEN_ADDRESSES[chain].USDC;
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    console.log(`[${chain} USDC Transfer] Token contract: ${tokenAddress}`);

    // 4. Get decimals and balance
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(wallet.address);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    console.log(`[${chain} USDC Transfer] Decimals: ${decimals}`);
    console.log(`[${chain} USDC Transfer] Balance: ${formattedBalance} USDC`);

    if (parseFloat(formattedBalance) < amount) {
      throw new Error(
        `Insufficient USDC balance. You have: ${formattedBalance} USDC, You need: ${amount} USDC`
      );
    }

    // 5. Transfer
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    console.log(`[${chain} USDC Transfer] Amount in smallest unit: ${amountInSmallestUnit.toString()}`);
    console.log(`[${chain} USDC Transfer] Sending transaction...`);

    const tx = await tokenContract.transfer(toAddress, amountInSmallestUnit);

    console.log(`[${chain} USDC Transfer] Transaction sent: ${tx.hash}`);
    console.log(`[${chain} USDC Transfer] Waiting for confirmation...`);

    const receipt = await tx.wait();

    console.log(`[${chain} USDC Transfer] ✅ Transfer successful!`);
    console.log(`[${chain} USDC Transfer] Block: ${receipt.blockNumber}`);

    return {
      success: true,
      signature: receipt.hash,
      fromAddress: wallet.address,
      toAddress,
      amount,
      explorerUrl: `${CHAIN_EXPLORERS[chain]}/tx/${receipt.hash}`
    };

  } catch (error: any) {
    console.error(`[${chain} USDC Transfer] ❌ Transfer failed:`, error);
    throw error;
  }
}

/**
 * Execute USDT transfer on EVM chain (pure function)
 * @param user - User object from database
 * @param toAddress - Recipient address
 * @param amount - Amount in USDT
 * @param chain - Target chain (BASE or CELO)
 * @returns Transaction result
 */
export async function executeUSDTTransferEVM(
  user: any,
  toAddress: string,
  amount: number,
  chain: 'BASE' | 'CELO'
) {
  console.log(`[${chain} USDT Transfer] Starting transaction...`);
  console.log(`[${chain} USDT Transfer] To: ${toAddress}, Amount: ${amount} USDT`);

  // Validate wallet exists
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    throw new Error('No EVM wallet found');
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // 1. Setup provider and wallet
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, provider);

    console.log(`[${chain} USDT Transfer] From wallet: ${wallet.address}`);

    // 2. Validate recipient address
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // 3. Setup token contract
    const tokenAddress = TOKEN_ADDRESSES[chain].USDT;
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    console.log(`[${chain} USDT Transfer] Token contract: ${tokenAddress}`);

    // 4. Get decimals and balance
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(wallet.address);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    console.log(`[${chain} USDT Transfer] Decimals: ${decimals}`);
    console.log(`[${chain} USDT Transfer] Balance: ${formattedBalance} USDT`);

    if (parseFloat(formattedBalance) < amount) {
      throw new Error(
        `Insufficient USDT balance. You have: ${formattedBalance} USDT, You need: ${amount} USDT`
      );
    }

    // 5. Transfer
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    console.log(`[${chain} USDT Transfer] Amount in smallest unit: ${amountInSmallestUnit.toString()}`);
    console.log(`[${chain} USDT Transfer] Sending transaction...`);

    const tx = await tokenContract.transfer(toAddress, amountInSmallestUnit);

    console.log(`[${chain} USDT Transfer] Transaction sent: ${tx.hash}`);
    console.log(`[${chain} USDT Transfer] Waiting for confirmation...`);

    const receipt = await tx.wait();

    console.log(`[${chain} USDT Transfer] ✅ Transfer successful!`);
    console.log(`[${chain} USDT Transfer] Block: ${receipt.blockNumber}`);

    return {
      success: true,
      signature: receipt.hash,
      fromAddress: wallet.address,
      toAddress,
      amount,
      explorerUrl: `${CHAIN_EXPLORERS[chain]}/tx/${receipt.hash}`
    };

  } catch (error: any) {
    console.error(`[${chain} USDT Transfer] ❌ Transfer failed:`, error);
    throw error;
  }
}
