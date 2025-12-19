import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getMint,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { config } from '@core/config/environment';
import { decryptPrivateKey } from '@shared/utils/encryption';

const connection = new Connection(config.solMainnet, 'confirmed');

// Token mint addresses on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

/**
 * Execute SOL transfer (pure function - no UI interactions)
 * @param user - User object from database
 * @param toAddress - Recipient Solana address
 * @param amount - Amount in SOL
 * @returns Transaction result
 */
export async function executeSolTransfer(user: any, toAddress: string, amount: number) {
  console.log('[SOL Transfer] Starting transaction...');
  console.log(`[SOL Transfer] To: ${toAddress}, Amount: ${amount} SOL`);

  // Validate wallet exists
  if (!user.solanaWallets || user.solanaWallets.length === 0 || !user.solanaWallets[0]) {
    throw new Error('No Solana wallet found');
  }

  if (!user.solanaWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);

  try {
    // 1. Load sender's wallet from private key
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      throw new Error('Invalid recipient address');
    }

    // 3. Check sender's balance
    const balance = await connection.getBalance(fromWallet.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`[SOL Transfer] Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`[SOL Transfer] Balance: ${solBalance} SOL`);

    // 4. Verify sufficient balance (amount + fee)
    const amountInLamports = amount * LAMPORTS_PER_SOL;
    const estimatedFee = 5000; // ~0.000005 SOL
    const totalNeeded = (amountInLamports + estimatedFee) / LAMPORTS_PER_SOL;

    if (balance < amountInLamports + estimatedFee) {
      throw new Error(
        `Insufficient balance. You have: ${solBalance.toFixed(2)} SOL, You need: ${totalNeeded.toFixed(6)} SOL (including transaction fee)`
      );
    }

    // 5. Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: toPublicKey,
        lamports: amountInLamports,
      })
    );

    // 6. Send and confirm transaction
    console.log('[SOL Transfer] Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('[SOL Transfer] ✅ Transfer successful!');
    console.log(`[SOL Transfer] Signature: ${signature}`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error: any) {
    console.error('[SOL Transfer] ❌ Transfer failed:', error);
    throw error;
  }
}

/**
 * Execute USDC transfer on Solana (pure function)
 * @param user - User object from database
 * @param toAddress - Recipient Solana address
 * @param amount - Amount in USDC
 * @returns Transaction result
 */
export async function executeUSDCTransfer(user: any, toAddress: string, amount: number) {
  console.log('[USDC Transfer] Starting transaction...');
  console.log(`[USDC Transfer] To: ${toAddress}, Amount: ${amount} USDC`);

  // Validate wallet exists
  if (!user.solanaWallets || user.solanaWallets.length === 0 || !user.solanaWallets[0]) {
    throw new Error('No Solana wallet found');
  }

  if (!user.solanaWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);

  try {
    // 1. Load sender's wallet
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      throw new Error('Invalid recipient address');
    }

    console.log(`[USDC Transfer] Sender: ${fromWallet.publicKey.toString()}`);

    // 3. Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      fromWallet.publicKey
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      toPublicKey
    );

    // 4. Get mint info for decimals
    const mintInfo = await getMint(connection, USDC_MINT);
    const amountInSmallestUnit = amount * Math.pow(10, mintInfo.decimals);

    console.log(`[USDC Transfer] Decimals: ${mintInfo.decimals}`);
    console.log(`[USDC Transfer] Amount in smallest unit: ${amountInSmallestUnit}`);

    // 5. Check sender's balance
    const fromAccount = await connection.getTokenAccountBalance(fromTokenAccount);
    const balance = parseFloat(fromAccount.value.amount) / Math.pow(10, mintInfo.decimals);

    console.log(`[USDC Transfer] Balance: ${balance} USDC`);

    if (balance < amount) {
      throw new Error(
        `Insufficient USDC balance. You have: ${balance.toFixed(2)} USDC, You need: ${amount} USDC`
      );
    }

    // 6. Check if recipient token account exists, create if not
    const transaction = new Transaction();

    try {
      await getAccount(connection, toTokenAccount);
      console.log('[USDC Transfer] Recipient token account exists');
    } catch (error) {
      console.log('[USDC Transfer] Creating recipient token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromWallet.publicKey,
          toTokenAccount,
          toPublicKey,
          USDC_MINT
        )
      );
    }

    // 7. Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet.publicKey,
        amountInSmallestUnit
      )
    );

    // 8. Send and confirm transaction
    console.log('[USDC Transfer] Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('[USDC Transfer] ✅ Transfer successful!');
    console.log(`[USDC Transfer] Signature: ${signature}`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error: any) {
    console.error('[USDC Transfer] ❌ Transfer failed:', error);
    throw error;
  }
}

/**
 * Execute USDT transfer on Solana (pure function)
 * @param user - User object from database
 * @param toAddress - Recipient Solana address
 * @param amount - Amount in USDT
 * @returns Transaction result
 */
export async function executeUSDTTransfer(user: any, toAddress: string, amount: number) {
  console.log('[USDT Transfer] Starting transaction...');
  console.log(`[USDT Transfer] To: ${toAddress}, Amount: ${amount} USDT`);

  // Validate wallet exists
  if (!user.solanaWallets || user.solanaWallets.length === 0 || !user.solanaWallets[0]) {
    throw new Error('No Solana wallet found');
  }

  if (!user.solanaWallets[0].encryptedPrivateKey) {
    throw new Error('Wallet private key not found');
  }

  const privKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);

  try {
    // 1. Load sender's wallet
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      throw new Error('Invalid recipient address');
    }

    console.log(`[USDT Transfer] Sender: ${fromWallet.publicKey.toString()}`);

    // 3. Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT,
      fromWallet.publicKey
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT,
      toPublicKey
    );

    // 4. Get mint info for decimals
    const mintInfo = await getMint(connection, USDT_MINT);
    const amountInSmallestUnit = amount * Math.pow(10, mintInfo.decimals);

    console.log(`[USDT Transfer] Decimals: ${mintInfo.decimals}`);
    console.log(`[USDT Transfer] Amount in smallest unit: ${amountInSmallestUnit}`);

    // 5. Check sender's balance
    const fromAccount = await connection.getTokenAccountBalance(fromTokenAccount);
    const balance = parseFloat(fromAccount.value.amount) / Math.pow(10, mintInfo.decimals);

    console.log(`[USDT Transfer] Balance: ${balance} USDT`);

    if (balance < amount) {
      throw new Error(
        `Insufficient USDT balance. You have: ${balance.toFixed(2)} USDT, You need: ${amount} USDT`
      );
    }

    // 6. Check if recipient token account exists, create if not
    const transaction = new Transaction();

    try {
      await getAccount(connection, toTokenAccount);
      console.log('[USDT Transfer] Recipient token account exists');
    } catch (error) {
      console.log('[USDT Transfer] Creating recipient token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromWallet.publicKey,
          toTokenAccount,
          toPublicKey,
          USDT_MINT
        )
      );
    }

    // 7. Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet.publicKey,
        amountInSmallestUnit
      )
    );

    // 8. Send and confirm transaction
    console.log('[USDT Transfer] Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('[USDT Transfer] ✅ Transfer successful!');
    console.log(`[USDT Transfer] Signature: ${signature}`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error: any) {
    console.error('[USDT Transfer] ❌ Transfer failed:', error);
    throw error;
  }
}
