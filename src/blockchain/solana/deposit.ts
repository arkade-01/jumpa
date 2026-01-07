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
import { fetchGroupAccount } from "./fetchData";

/**
 * Deposit additional funds to a group
 */
export interface DepositParams {
  telegramId: number;
  groupPDA: string;
  amount: number; // in SOL (will be converted to lamports)
}

export async function deposit(params: DepositParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, signer);

    // Convert SOL to lamports
    const amountLamports = params.amount * 1_000_000_000;

    // Fetch group account to check minimum deposit requirement
    const groupAccount = await fetchGroupAccount(params.groupPDA, params.telegramId);
    const minimumDepositLamports = parseInt(groupAccount.minimumDeposit);

    // Validate against minimum deposit
    if (minimumDepositLamports > 0 && amountLamports < minimumDepositLamports) {
      const minimumDepositSol = (minimumDepositLamports / 1_000_000_000).toFixed(4);
      throw new Error(
        `Deposit amount is below the minimum required. Minimum deposit: ${minimumDepositSol} SOL. ` +
        `You are trying to deposit: ${params.amount} SOL.`
      );
    }

    // Check wallet balance (need amount + transaction fees)
    const requiredBalance = amountLamports + 5_000_000; // Amount + 0.005 SOL for fees
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, requiredBalance);
      console.log(`Wallet balance check for ${signer.toBase58()}:`, balanceCheck);
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1_000_000_000).toFixed(4);
        const requiredInSol = (requiredBalance / 1_000_000_000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Required: ${requiredInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError;
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Depositing ${params.amount} SOL (${amountLamports} lamports) to group`);
    console.log(`Group PDA: ${params.groupPDA}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .deposit(new BN(amountLamports))
        .accounts({
          signer: signer,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000);

    console.log(`Deposit successful! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Deposit transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
      amount: params.amount,
      amountLamports: amountLamports
    };
  } catch (error) {
    console.error("Error depositing to group:", error);
    throw error;
  }
}
