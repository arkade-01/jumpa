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
  getMint
} from '@solana/spl-token';
import { config } from '@core/config/config';
import getUser from '@modules/users/getUserInfo';
import { Context } from 'telegraf';
import { decryptPrivateKey } from '@shared/utils/encryption';

const connection = new Connection(config.solMainnet, 'confirmed');
// const signer = keypair.publicKey;

// Token mint addresses on Solana mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');


export async function WithdrawSolToNgn(ctx: Context, toAddress, amount) {
  console.log("initiating withdrawal...")
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
  
  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  // Validate Solana wallet exists
  if (!user.solanaWallets || user.solanaWallets.length === 0 || !user.solanaWallets[0]) {
    await ctx.reply(
      "❌ No Solana wallet found. Please create a wallet first."
    );
    return { success: false, error: 'No Solana wallet found' };
  }

  if (!user.solanaWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet private key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet private key not found' };
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
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Check sender's balance
    const balance = await connection.getBalance(fromWallet.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`Balance: ${solBalance} SOL`);
    console.log(`Recipient: ${toAddress}`);
    console.log(`Amount: ${amount} SOL`);

    // 4. Verify sufficient balance (amount + fee)
    const amountInLamports = amount * LAMPORTS_PER_SOL;
    const estimatedFee = 5000; // ~0.000005 SOL
    const totalNeeded = (amountInLamports + estimatedFee) / LAMPORTS_PER_SOL;

    if (balance < amountInLamports + estimatedFee) {
      return {
        success: false,
        error: `Insufficient balance. You have: ${solBalance.toFixed(2)} SOL, You need a minimum of ${totalNeeded.toFixed(6)} SOL to cover both transaction fee and amount you are trying to withdraw`
      };
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
    console.log('\n📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('✅ Transfer successful!');
    console.log(`Transaction: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

    // 7. Check new balances
    const newBalance = await connection.getBalance(fromWallet.publicKey);
    console.log(`\nNew sender balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function WithdrawUSDCToNgn(ctx: Context, toAddress: string, amount: number) {
  console.log("initiating USDC withdrawal...")
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
 
  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  // Validate evm wallet exists for USDC
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    await ctx.reply(
      "❌ No EVM wallet found. Please create a wallet first."
    );
    return { success: false, error: 'No EVM wallet found' };
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet key not found' };
  }

  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);

  try {
    // 1. Load sender's wallet from private key
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Get token mint info to know decimals
    const mintInfo = await getMint(connection, USDC_MINT);
    console.log("usdc mint info: ", mintInfo)
    const decimals = mintInfo.decimals;
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // 4. Get sender's USDC token account
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      fromWallet.publicKey
    );

    // 5. Get recipient's USDC token account
    const toTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      toPublicKey
    );

    // 6. Check sender's USDC balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      fromWallet.publicKey,
      { mint: USDC_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return {
        success: false,
        error: `You do not have a USDC token account. Balance: 0 USDC`
      };
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    const usdcBalance = balanceInfo.uiAmount;
    const balanceInSmallestUnit = balanceInfo.amount;

    console.log(`Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`USDC Balance: ${usdcBalance} USDC`);
    console.log(`Recipient: ${toAddress}`);
    console.log(`Amount: ${amount} USDC`);

    // 7. Verify sufficient balance
    if (BigInt(balanceInSmallestUnit) < BigInt(amountInSmallestUnit)) {
      return {
        success: false,
        error: `Insufficient USDC balance. You have: ${usdcBalance.toFixed(6)} USDC, You need: ${amount.toFixed(6)} USDC`
      };
    }

    // 8. Check if sender has SOL for transaction fees
    const solBalance = await connection.getBalance(fromWallet.publicKey);
    const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
    const estimatedFee = 0.000005; // ~5000 lamports

    if (solBalanceInSol < estimatedFee) {
      return {
        success: false,
        error: `Insufficient SOL for transaction fees. You have: ${solBalanceInSol.toFixed(6)} SOL, You need at least ${estimatedFee} SOL`
      };
    }

    // 9. Create token transfer instruction
    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet.publicKey,
        amountInSmallestUnit
      )
    );

    // 10. Send and confirm transaction
    console.log('\n📤 Sending USDC transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('✅ USDC transfer successful!');
    console.log(`Transaction: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

    // 11. Check new balance
    const newTokenAccounts = await connection.getParsedTokenAccountsByOwner(
      fromWallet.publicKey,
      { mint: USDC_MINT }
    );
    const newBalance = newTokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
    console.log(`\nNew USDC balance: ${newBalance} USDC`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error) {
    console.error('❌ USDC transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function WithdrawUSDTToNgn(ctx: Context, toAddress: string, amount: number) {
  console.log("initiating USDT withdrawal...")
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
 
  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return { success: false, error: 'User not found' };
  }

  // Validate Solana wallet exists for USDT (SPL token on Solana)
  if (!user.evmWallets || user.evmWallets.length === 0 || !user.evmWallets[0]) {
    await ctx.reply(
      "❌ No EVM wallet found. Please create a wallet first."
    );
    return { success: false, error: 'No EVM wallet found' };
  }

  if (!user.evmWallets[0].encryptedPrivateKey) {
    await ctx.reply(
      "❌ Wallet key not found. Please recreate your wallet."
    );
    return { success: false, error: 'Wallet key not found' };
  }
  //PROBLEM HERE
  const privKey = decryptPrivateKey(user.evmWallets[0].encryptedPrivateKey);
  try {
    // 1. Load sender's wallet from private key
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Validate recipient address
    let toPublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (e) {
      return { success: false, error: 'Invalid recipient address' };
    }

    // 3. Get token mint info to know decimals
    const mintInfo = await getMint(connection, USDT_MINT);
    console.log("usdt mint info: ", mintInfo)
    const decimals = mintInfo.decimals;
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // 4. Get sender's USDT token account
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT,
      fromWallet.publicKey
    );

    // 5. Get recipient's USDT token account
    const toTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT,
      toPublicKey
    );

    // 6. Check sender's USDT balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      fromWallet.publicKey,
      { mint: USDT_MINT }
    );

    if (tokenAccounts.value.length === 0) {
      return {
        success: false,
        error: `You do not have a USDT token account. Balance: 0 USDT`
      };
    }

    const balanceInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    const usdtBalance = balanceInfo.uiAmount;
    const balanceInSmallestUnit = balanceInfo.amount;

    console.log(`Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`USDT Balance: ${usdtBalance} USDT`);
    console.log(`Recipient: ${toAddress}`);
    console.log(`Amount: ${amount} USDT`);

    // 7. Verify sufficient balance
    if (BigInt(balanceInSmallestUnit) < BigInt(amountInSmallestUnit)) {
      return {
        success: false,
        error: `Insufficient USDT balance. You have: ${usdtBalance.toFixed(6)} USDT, You need: ${amount.toFixed(6)} USDT`
      };
    }

    // 8. Check if sender has SOL for transaction fees
    const solBalance = await connection.getBalance(fromWallet.publicKey);
    const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
    const estimatedFee = 0.000005; // ~5000 lamports

    if (solBalanceInSol < estimatedFee) {
      return {
        success: false,
        error: `Insufficient SOL for transaction fees. You have: ${solBalanceInSol.toFixed(6)} SOL, You need at least ${estimatedFee} SOL`
      };
    }

    // 9. Create token transfer instruction
    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromWallet.publicKey,
        amountInSmallestUnit
      )
    );

    // 10. Send and confirm transaction
    console.log('\n📤 Sending USDT transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    console.log('✅ USDT transfer successful!');
    console.log(`Transaction: ${signature}`);
    console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

    // 11. Check new balance
    const newTokenAccounts = await connection.getParsedTokenAccountsByOwner(
      fromWallet.publicKey,
      { mint: USDT_MINT }
    );
    const newBalance = newTokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
    console.log(`\nNew USDT balance: ${newBalance} USDT`);

    return {
      success: true,
      signature,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: toAddress,
      amount: amount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };

  } catch (error) {
    console.error('❌ USDT transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}