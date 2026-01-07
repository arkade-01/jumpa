import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {
  getProviderForUser,
  getProgram,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Set the exit penalty percentage for a group (admin only)
 * Penalty must be between 80 and 100
 */
export interface SetExitPenaltyParams {
  telegramId: number;
  groupPDA: string;
  penaltyPercentage: number; // Must be between 80 and 100
}

export async function setExitPenalty(params: SetExitPenaltyParams) {
  try {
    // Validate penalty percentage
    if (params.penaltyPercentage < 80 || params.penaltyPercentage > 100) {
      throw new Error('Exit penalty percentage must be between 80 and 100');
    }

    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);

    // Check wallet balance for transaction fees
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5_000_000); // 0.005 SOL for fees
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1_000_000_000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1_000_000_000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError;
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Setting exit penalty to ${params.penaltyPercentage}% for group: ${params.groupPDA}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .setExitPenalty(params.penaltyPercentage)
        .accounts({
          signer: signer,
          group: groupPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Exit penalty updated! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Set exit penalty transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      penaltyPercentage: params.penaltyPercentage
    };
  } catch (error) {
    console.error("Error setting exit penalty:", error);
    throw error;
  }
}

/**
 * Set the minimum deposit amount for a group (admin only)
 */
export interface SetMinimumDepositParams {
  telegramId: number;
  groupPDA: string;
  newMinimum: number; // in SOL (will be converted to lamports)
}

export async function setMinimumDeposit(params: SetMinimumDepositParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);

    // Convert SOL to lamports
    const newMinimumLamports = params.newMinimum * 1_000_000_000;

    // Check wallet balance for transaction fees
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5_000_000); // 0.005 SOL for fees
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1_000_000_000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1_000_000_000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError;
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Setting minimum deposit to ${params.newMinimum} SOL (${newMinimumLamports} lamports) for group: ${params.groupPDA}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .setMinimumDeposit(new BN(newMinimumLamports))
        .accounts({
          signer: signer,
          group: groupPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Minimum deposit updated! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Set minimum deposit transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      newMinimum: params.newMinimum,
      newMinimumLamports: newMinimumLamports
    };
  } catch (error) {
    console.error("Error setting minimum deposit:", error);
    throw error;
  }
}
