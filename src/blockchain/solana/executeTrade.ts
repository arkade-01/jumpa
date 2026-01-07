import { PublicKey, AccountMeta } from "@solana/web3.js";
import BN from "bn.js";
import {
  getProviderForUser,
  getProgram,
  executeTransactionWithTimeout,
  verifyTransactionSuccess,
} from "./utils";
import { fetchGroupAccount } from "./fetchData";

/**
 * Execute a swap trade on behalf of the group via Jupiter CPI
 */
export interface ExecuteTradeParams {
  telegramId: number; // identifies the trader/admin
  groupPDA: string; // group public key (string form)
  tokenMintIn: string; // token you’re selling
  tokenMintOut: string; // token you’re buying
  groupTokenAccountIn: string; // group’s input token account
  groupTokenAccountOut: string; // group’s output token account
  jupiterProgram: string; // Jupiter program ID
  amountIn: number; // raw amount in smallest unit (e.g. lamports)
  minAmountOut: number; // minimum acceptable output (for slippage protection)
  instructionData: Buffer; // Jupiter swap instruction bytes (from Jupiter API)
  remainingAccounts: AccountMeta[]; // route-specific accounts from Jupiter
}

export async function executeTrade(params: ExecuteTradeParams) {
  try {
    const {
      telegramId,
      groupPDA,
      tokenMintIn,
      tokenMintOut,
      groupTokenAccountIn,
      groupTokenAccountOut,
      jupiterProgram,
      amountIn,
      minAmountOut,
      instructionData,
      remainingAccounts,
    } = params;
    console.log("🚀 Executing trade...", params)

    // Get provider and Anchor program
    const provider = await getProviderForUser(telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;
    const groupPubkey = new PublicKey(groupPDA);

    // Optionally confirm group is active
    const groupAccount = await fetchGroupAccount(groupPDA, telegramId);
    console.log("group account:", groupAccount)
    if (groupAccount.state === "Ended") {
      throw new Error(`Group ${groupPDA} has already ended.`);
    }

    console.log("🚀 Executing trade on behalf of group:", groupPDA);
    console.log(`Trader/Admin: ${signer.toBase58()}`);
    console.log(`Swap: ${tokenMintIn} → ${tokenMintOut}`);
    console.log(`Amount In: ${amountIn}, Min Out: ${minAmountOut}`);

    // Prepare accounts
    const accounts = {
      signer,
      group: groupPubkey,
      groupTokenAccountIn: new PublicKey(groupTokenAccountIn),
      groupTokenAccountOut: new PublicKey(groupTokenAccountOut),
      tokenMintIn: new PublicKey(tokenMintIn),
      tokenMintOut: new PublicKey(tokenMintOut),
      jupiterProgram: new PublicKey(jupiterProgram),
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      systemProgram: new PublicKey("11111111111111111111111111111111"),
    };

    // Execute with timeout & confirmation
    const txSig = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .executeSwap(
          new BN(amountIn),
          new BN(minAmountOut),
          Buffer.from(instructionData)
        )
        .accounts(accounts)
        .remainingAccounts(remainingAccounts)
        .rpc();
    }, 180000); // 3 min timeout (Jupiter swaps can take longer)

    console.log(`✅ Trade transaction sent: ${txSig}`);

    // Verify the transaction completed successfully
    const isSuccessful = await verifyTransactionSuccess(txSig);
    if (!isSuccessful) {
      throw new Error(`Trade transaction ${txSig} failed verification`);
    }

    console.log(`🎉 Trade executed successfully! TX: ${txSig}`);
    return {
      success: true,
      signature: txSig,
      amountIn,
      minAmountOut,
      tokenMintIn,
      tokenMintOut,
    };
  } catch (error) {
    console.error("❌ Error executing trade:", error);
    throw error;
  }
}
