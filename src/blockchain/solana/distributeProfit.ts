import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {
  getProviderForUser,
  getProgram,
  deriveMemberProfilePDA,
  checkWalletBalance,
  executeTransactionWithTimeout,
  verifyTransactionSuccess
} from "./utils";

/**
 * Distribute profit to a group member (traders only)
 */
export interface DistributeProfitParams {
  telegramId: number;
  groupPDA: string;
  recipientPubkey: string; // The member receiving the profit
  amount: number; // in SOL (will be converted to lamports)
}

export async function distributeProfit(params: DistributeProfitParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const recipientPubkey = new PublicKey(params.recipientPubkey);
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, recipientPubkey);

    // Convert SOL to lamports
    const amountLamports = params.amount * 1_000_000_000;

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

    console.log(`Distributing ${params.amount} SOL (${amountLamports} lamports) to ${params.recipientPubkey}`);
    console.log(`Group PDA: ${params.groupPDA}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout
    // Use accountsStrict to ensure all accounts are properly configured from the IDL
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .distributeProfit(new BN(amountLamports))
        .accountsStrict({
          signer: signer,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          recipient: recipientPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Profit distributed! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Distribute profit transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      recipient: params.recipientPubkey,
      amount: params.amount,
      amountLamports: amountLamports
    };
  } catch (error) {
    console.error("Error distributing profit:", error);
    throw error;
  }
}
