import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";
import { getSolanaConnection } from "@shared/utils/rpcConfig";
import { decryptPrivateKey } from "@shared/utils/encryption";
import idlJson from "./idl.json";
import User from "@database/models/user";

// Program ID from IDL
const PROGRAM_ID = new PublicKey(idlJson.address);

// Seed constants (from IDL)
const GROUP_SEED = Buffer.from("GROUP_SEED");
const MEMBER_SEED = Buffer.from("MEMBER_SEED");
const PROPOSAL_SEED = Buffer.from("PROPOSAL_SEED");
const VOTE_SEED = Buffer.from("VOTE_SEED");

/**
 * Create a wallet wrapper from keypair
 */
function createWalletFromKeypair(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    payer: keypair,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.partialSign(keypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      return txs.map(tx => {
        if (tx instanceof Transaction) {
          tx.partialSign(keypair);
        }
        return tx;
      });
    }
  };
}

/**
 * Get Anchor provider for a user
 */
export async function getProviderForUser(telegramId: number): Promise<AnchorProvider> {
  const connection = getSolanaConnection();
  const user = await User.findOne({ telegram_id: telegramId });

  if (!user) {
    throw new Error("User not found. Please register first.");
  }

  // Decrypt private key and create keypair
  const decryptedKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
  const keypair = Keypair.fromSecretKey(
    Buffer.from(decryptedKey, 'hex')
  );

  // Create wallet wrapper
  const wallet = createWalletFromKeypair(keypair);

  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

/**
 * Get the Anchor program instance
 */
export function getProgram(provider: AnchorProvider): Program {
  return new Program(idlJson as any, provider);
}

/**
 * Derive Group PDA
 * Seeds: GROUP_SEED, group_name (uppercase), signer public key
 * Anchor encodes strings with UTF-8 encoding
 */
export function deriveGroupPDA(groupName: string, signer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, Buffer.from(groupName.toUpperCase(), 'utf8'), signer.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive MemberProfile PDA
 */
export function deriveMemberProfilePDA(group: PublicKey, member: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MEMBER_SEED, group.toBuffer(), member.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive TradeProposal PDA
 * Seeds: PROPOSAL_SEED, signer public key, group public key, nonce
 */
export function deriveProposalPDA(
  proposer: PublicKey,
  group: PublicKey,
  nonce: BN
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64BE(BigInt(nonce.toString())); // Use Big Endian to match Rust's to_be_bytes()

  return PublicKey.findProgramAddressSync(
    [PROPOSAL_SEED, proposer.toBuffer(), group.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
}

/**
 * Derive Vote PDA
 * Seeds: VOTE_SEED, proposal public key, signer public key
 */
export function deriveVotePDA(
  proposal: PublicKey,
  signer: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, proposal.toBuffer(), signer.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Check if a group already exists on-chain
 */
export async function checkGroupExists(groupName: string, signer: PublicKey): Promise<boolean> {
  try {
    const [groupPDA] = deriveGroupPDA(groupName, signer);

    // Try to fetch the account info
    const connection = getSolanaConnection();
    const accountInfo = await connection.getAccountInfo(groupPDA);

    // If account exists and has data, the group already exists
    return accountInfo !== null && accountInfo.data.length > 0;
  } catch (error) {
    console.error("Error checking group existence:", error);
    return false;
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 */
export async function checkWalletBalance(walletAddress: PublicKey, minBalanceLamports: number = 5000000): Promise<{ hasBalance: boolean; balance: number; minBalance: number }> {
  try {
    const connection = getSolanaConnection();
    const balance = await connection.getBalance(walletAddress);

    return {
      hasBalance: balance >= minBalanceLamports,
      balance: balance,
      minBalance: minBalanceLamports
    };
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return {
      hasBalance: false,
      balance: 0,
      minBalance: minBalanceLamports
    };
  }
}

/**
 * Execute a Solana transaction with timeout (NO RETRIES to prevent double-execution)
 * Retrying state-changing operations can cause issues since the first attempt may have succeeded on-chain
 * even if WebSocket confirmation failed.
 */
async function executeTransactionWithTimeout<T>(
  transactionFn: () => Promise<T>,
  timeoutMs: number = 120000 // 2 minutes
): Promise<T> {
  console.log(`Executing transaction with ${timeoutMs}ms timeout...`);

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Transaction timed out after ${timeoutMs}ms. The transaction may still have succeeded on-chain. Please check the blockchain explorer.`));
    }, timeoutMs);
  });

  // Race between transaction and timeout
  const result = await Promise.race([
    transactionFn(),
    timeoutPromise
  ]);

  console.log(`Transaction completed successfully`);
  return result;
}

/**
 * Verify transaction was successful by checking the transaction signature
 */
async function verifyTransactionSuccess(signature: string): Promise<boolean> {
  try {
    const connection = getSolanaConnection();

    // Wait a bit for transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get transaction details
    const txDetails = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!txDetails) {
      console.log('Transaction not found in blockchain');
      return false;
    }

    if (txDetails.meta?.err) {
      console.log('Transaction failed:', txDetails.meta.err);
      return false;
    }

    console.log('Transaction verified successfully');
    return true;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

/**
 * Initialize a new group on-chain
 */
export interface InitializeGroupParams {
  telegramId: number;
  groupName: string;
  adminName: string;
  isPrivate: boolean; // specify private or public group type
}

export async function initializeGroup(params: InitializeGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    // Check if group already exists on-chain
    const groupExists = await checkGroupExists(params.groupName, signer);
    if (groupExists) {
      const [groupPDA] = deriveGroupPDA(params.groupName, signer);
      throw new Error(`Group "${params.groupName}" already exists on-chain at address: ${groupPDA.toBase58()}`);
    }

    // Check wallet balance before attempting transaction
    const balanceCheck = await checkWalletBalance(signer, 50000000); // 0.05 SOL minimum
    console.log(`Wallet balance: ${balanceCheck.balance} lamports. Minimum required: ${balanceCheck.minBalance} lamports.`);
    if (!balanceCheck.hasBalance) {
      const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
      const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
      throw new Error(
        `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
        `Please fund your wallet at: ${signer.toBase58()}`
      );
    }

    // Debug: Log the seed components
    console.log('=== PDA Derivation Debug ===');
    console.log('Group Name:', params.groupName);
    console.log('Group Name (hex):', Buffer.from(params.groupName, 'utf8').toString('hex'));
    console.log('Signer Pubkey:', signer.toBase58());
    console.log('GROUP_SEED:', GROUP_SEED.toString('hex'));

    // Derive PDAs
    const [groupPDA, groupBump] = deriveGroupPDA(params.groupName, signer);
    const [memberProfilePDA, memberBump] = deriveMemberProfilePDA(groupPDA, signer);

    console.log(`Initializing group: ${params.groupName}`);
    console.log(`Derived Group PDA: ${groupPDA.toBase58()}`);
    console.log(`Derived Member Profile PDA: ${memberProfilePDA.toBase58()}`);
    console.log(`Group Bump: ${groupBump}`);
    console.log('=============================');

    // Execute the transaction with timeout (no retries to prevent double-execution)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .initializeGroup(
          params.groupName,
          params.adminName,
          params.isPrivate
        )
        .accounts({
          signer: signer,
          group: groupPDA,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([]) // Explicitly set signers (signer is from provider)
        .rpc();
    }, 120000); // 2 minute timeout

    console.log(`Group initialized! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Transaction ${tx} failed verification`);
    }

    return {
      success: true,
      groupPDA: groupPDA.toBase58(),
      memberProfilePDA: memberProfilePDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error initializing group:", error);
    throw error;
  }
}

/**
 * Join an existing group
 */
export interface JoinGroupParams {
  telegramId: number;
  groupPDA: string;
  ownerPubkey: string;
  memberName: string;
}

export async function joinGroup(params: JoinGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const ownerPubkey = new PublicKey(params.ownerPubkey);

    // Check if member profile already exists
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, signer);
    const connection = getSolanaConnection();

    let memberAccountInfo;
    try {
      memberAccountInfo = await connection.getAccountInfo(memberProfilePDA);
    } catch (rpcError) {
      console.warn('Failed to check existing member profile, continuing anyway:', rpcError);
      // Continue without checking - the on-chain program will reject if already exists
      memberAccountInfo = null;
    }

    if (memberAccountInfo && memberAccountInfo.data.length > 0) {
      throw new Error(`You are already a member of this group. Member profile exists at: ${memberProfilePDA.toBase58()}`);
    }

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError; // Re-throw insufficient balance errors
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
      // Continue without balance check - transaction will fail if insufficient funds
    }

    console.log(`Joining group: ${params.groupPDA}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Execute the transaction with timeout (no retries to prevent double-execution)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .joinGroup(params.memberName)
        .accounts({
          signer: signer,
          owner: ownerPubkey,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000); // 2 minute timeout

    console.log(`Joined group! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Join group transaction ${tx} failed verification`);
    }

    return {
      success: true,
      memberProfilePDA: memberProfilePDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
}

/**
 * Exit an group
 */
export interface ExitGroupParams {
  telegramId: number;
  groupPDA: string;
}

export async function exitGroup(params: ExitGroupParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPubkey, signer);

    console.log(`Exiting group`);
    console.log(`Group PDA: ${groupPubkey.toBase58()}`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);

    // Check wallet balance
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000);
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
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

    // Execute the transaction with timeout (no retries to prevent double-execution)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .exitGroup()
        .accounts({
          signer: signer,
          group: groupPubkey,
          memberProfile: memberProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000); // 2 minute timeout

    console.log(`Exited group! Transaction: ${tx}`);

    // Verify transaction
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Exit group transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error exiting group:", error);
    throw error;
  }
}

/**
 * Add a trader to the group
 */
export interface AddTraderParams {
  telegramId: number;
  groupPDA: string;
  traderPubkey: string;
}

export async function addTrader(params: AddTraderParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const traderPubkey = new PublicKey(params.traderPubkey);

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError; // Re-throw insufficient balance errors
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Adding trader: ${params.traderPubkey}`);

    // Execute the transaction with timeout (no retries to prevent double-execution)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .addTrader()
        .accounts({
          signer: signer,
          group: groupPubkey,
          trader: traderPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({
          skipPreflight: false,
          commitment: 'confirmed',
        });
    }, 120000); // 2 minute timeout

    console.log(`Trader added! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Add trader transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error adding trader:", error);
    throw error;
  }
}

/**
 * Remove a trader from the group
 */
export interface RemoveTraderParams {
  telegramId: number;
  groupPDA: string;
  traderPubkey: string;
}

export async function removeTrader(params: RemoveTraderParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const traderPubkey = new PublicKey(params.traderPubkey);

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError; // Re-throw insufficient balance errors
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    console.log(`Removing trader: ${params.traderPubkey}`);

    // Execute the transaction with timeout (no retries to prevent double-execution)
    const tx = await executeTransactionWithTimeout(async () => {
      return await program.methods
        .removeTrader()
        .accounts({
          signer: signer,
          group: groupPubkey,
          trader: traderPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, 120000); // 2 minute timeout

    console.log(`Trader removed! Transaction: ${tx}`);

    // Verify the transaction was successful
    const isSuccessful = await verifyTransactionSuccess(tx);
    if (!isSuccessful) {
      throw new Error(`Remove trader transaction ${tx} failed verification`);
    }

    return {
      success: true,
      signature: tx,
    };
  } catch (error) {
    console.error("Error removing trader:", error);
    throw error;
  }
}

/**
 * Propose a trade
 */
export interface ProposeTradeParams {
  telegramId: number;
  groupPDA: string;
  ownerPubkey: string;
  name: string;
  nonce: number;
  amount: number; // Token amount
  buy: boolean; // true for buy, false for sell
  tokenAccount: string;
  mintAccount: string;
}

export async function proposeTrade(params: ProposeTradeParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const groupPubkey = new PublicKey(params.groupPDA);
    const ownerPubkey = new PublicKey(params.ownerPubkey);
    const tokenAccountPubkey = new PublicKey(params.tokenAccount);
    const mintAccountPubkey = new PublicKey(params.mintAccount);

    // Derive PDAs
    const [proposalPDA, proposalBump] = deriveProposalPDA(
      signer,
      groupPubkey,
      new BN(params.nonce)
    );
    const [memberProfilePDA, memberBump] = deriveMemberProfilePDA(groupPubkey, signer);

    console.log('=== Proposal PDA Derivation Debug ===');
    console.log(`Proposing trade: ${params.name}`);
    console.log(`PROPOSAL_SEED: ${PROPOSAL_SEED.toString('hex')}`);
    console.log(`Signer (proposer): ${signer.toBase58()}`);
    console.log(`Signer bytes (hex): ${signer.toBuffer().toString('hex')}`);
    console.log(`Group PDA: ${groupPubkey.toBase58()}`);
    console.log(`Group bytes (hex): ${groupPubkey.toBuffer().toString('hex')}`);
    console.log(`Nonce: ${params.nonce}`);

    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64BE(BigInt(params.nonce));
    console.log(`Nonce (hex BE): ${nonceBuf.toString('hex')}`);
    console.log(`Nonce (base64): ${nonceBuf.toString('base64')}`);

    console.log(`Derived Proposal PDA: ${proposalPDA.toBase58()}`);
    console.log(`Expected by program: 4Beiqhg9dzKcq7e5c6cNUvNdG6Rss27ADFsoYfhSmFX9`);
    console.log(`Member Profile PDA: ${memberProfilePDA.toBase58()}`);
    console.log('=====================================');

    // Check wallet balance before attempting transaction
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000); // 0.005 SOL minimum
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
        throw new Error(
          `Insufficient SOL balance. Your balance: ${balanceInSol} SOL. Minimum required: ${minBalanceInSol} SOL. ` +
          `Please fund your wallet at: ${signer.toBase58()}`
        );
      }
    } catch (balanceError) {
      if (balanceError instanceof Error && balanceError.message.includes('Insufficient SOL')) {
        throw balanceError; // Re-throw insufficient balance errors
      }
      console.warn('Failed to check wallet balance, continuing anyway:', balanceError);
    }

    // Execute the transaction (no retry to keep nonce consistent for debugging)
    const tx = await program.methods
      .proposeTrade(
        params.name,
        new BN(params.nonce),
        new BN(params.amount),
        params.buy
      )
      .accounts({
        signer: signer,
        owner: ownerPubkey,
        group: groupPubkey,
        proposal: proposalPDA,
        tokenAccount: tokenAccountPubkey,
        mintAccount: mintAccountPubkey,
        memberProfile: memberProfilePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Trade proposed! Transaction: ${tx}`);

    // Anchor derives the PDA, so we need to return the one we calculated
    // (it should match what Anchor created)
    return {
      success: true,
      proposalPDA: proposalPDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error proposing trade:", error);
    throw error;
  }
}

/**
 * Vote on a trade proposal
 */
export interface VoteParams {
  telegramId: number;
  groupName: string;
  ownerPubkey: string;
  proposalNonce: number;
  yesVote: boolean; // true for yes, false for no
}

export async function vote(params: VoteParams) {
  try {
    const provider = await getProviderForUser(params.telegramId);
    const program = getProgram(provider);
    const signer = provider.wallet.publicKey;

    const ownerPubkey = new PublicKey(params.ownerPubkey);

    // Derive PDAs
    const [groupPDA] = deriveGroupPDA(params.groupName, ownerPubkey);
    const [memberProfilePDA] = deriveMemberProfilePDA(groupPDA, signer);
    const [proposalPDA] = deriveProposalPDA(signer, groupPDA, new BN(params.proposalNonce));
    const [votePDA] = deriveVotePDA(proposalPDA, signer);

    console.log('=== Vote PDA Derivation Debug ===');
    console.log(`Voter (signer): ${signer.toBase58()}`);
    console.log(`Group Name: ${params.groupName}`);
    console.log(`Owner: ${ownerPubkey.toBase58()}`);
    console.log(`Proposal Nonce: ${params.proposalNonce}`);
    console.log(`Derived Group PDA: ${groupPDA.toBase58()}`);
    console.log(`Derived Proposal PDA: ${proposalPDA.toBase58()}`);
    console.log(`Derived Vote PDA: ${votePDA.toBase58()}`);
    console.log(`Vote: ${params.yesVote ? 'YES' : 'NO'}`);
    console.log('====================================');

    // Check wallet balance
    let balanceCheck;
    try {
      balanceCheck = await checkWalletBalance(signer, 5000000);
      if (!balanceCheck.hasBalance) {
        const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
        const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);
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

    // Execute the vote transaction
    const tx = await program.methods
      .vote(
        params.groupName,
        new BN(params.proposalNonce),
        params.yesVote
      )
      .accounts({
        signer: signer,
        owner: ownerPubkey,
        group: groupPDA,
        memberProfile: memberProfilePDA,
        proposal: proposalPDA,
        vote: votePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Vote recorded! Transaction: ${tx}`);

    return {
      success: true,
      votePDA: votePDA.toBase58(),
      signature: tx,
    };
  } catch (error) {
    console.error("Error voting:", error);
    throw error;
  }
}

/**
 * Fetch on-chain Group account data
 */
export async function fetchGroupAccount(groupPDA: string, telegramId?: number) {
  try {
    let provider: AnchorProvider;

    if (telegramId) {
      provider = await getProviderForUser(telegramId);
    } else {
      // Use a read-only provider
      const connection = getSolanaConnection();
      const dummyKeypair = Keypair.generate();
      const wallet = createWalletFromKeypair(dummyKeypair);
      provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }

    const program = getProgram(provider);
    const groupPubkey = new PublicKey(groupPDA);

    const groupAccount: any = await program.account['group'].fetch(groupPubkey);

    return {
      owner: groupAccount.owner.toBase58(),
      name: groupAccount.name,
      traders: groupAccount.traders.map((t: any) => t.toBase58()),
      members: groupAccount.members.map((m: any) => m.toBase58()),
      blacklist: groupAccount.blacklist.map((b: any) => b.toBase58()),
      minimumDeposit: groupAccount.minimum_deposit?.toString() || "0",
      totalContributions: groupAccount.total_contributions?.toString() || "0",
      exitPenaltyPercentage: groupAccount.exit_penalty_percentage || 0,
      lockPeriodDays: groupAccount.lock_period_days || 0,
      locked: groupAccount.locked,
      isPrivate: groupAccount.is_private || false,
      state: groupAccount.state,
      createdAt: new Date(groupAccount.created_at.toNumber() * 1000),
    };
  } catch (error) {
    console.error("Error fetching group account:", error);
    throw error;
  }
}

/**
 * Fetch on-chain MemberProfile account data
 */
export async function fetchMemberProfile(memberProfilePDA: string, telegramId?: number) {
  try {
    let provider: AnchorProvider;

    if (telegramId) {
      provider = await getProviderForUser(telegramId);
    } else {
      const connection = getSolanaConnection();
      const dummyKeypair = Keypair.generate();
      const wallet = createWalletFromKeypair(dummyKeypair);
      provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }

    const program = getProgram(provider);
    const memberProfilePubkey = new PublicKey(memberProfilePDA);

    const memberProfile: any = await program.account['memberProfile'].fetch(memberProfilePubkey);

    return {
      group: memberProfile.group.toBase58(),
      pubkey: memberProfile.pubkey.toBase58(),
      name: memberProfile.name,
      lastProposalDate: memberProfile.lastProposalDate
        ? new Date(memberProfile.lastProposalDate.toNumber() * 1000)
        : null,
    };
  } catch (error) {
    console.error("Error fetching member profile:", error);
    throw error;
  }
}

/**
 * Fetch on-chain TradeProposal account data
 */
export async function fetchTradeProposal(proposalPDA: string, telegramId?: number) {
  try {
    let provider: AnchorProvider;

    if (telegramId) {
      provider = await getProviderForUser(telegramId);
    } else {
      const connection = getSolanaConnection();
      const dummyKeypair = Keypair.generate();
      const wallet = createWalletFromKeypair(dummyKeypair);
      provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    }

    const program = getProgram(provider);
    const proposalPubkey = new PublicKey(proposalPDA);

    const proposal: any = await program.account['tradeProposal'].fetch(proposalPubkey);

    return {
      group: proposal.group.toBase58(),
      proposer: proposal.proposer.toBase58(),
      proposerName: proposal.proposerName,
      voteCount: proposal.voteCount,
      amount: proposal.amount.toString(),
      targetMint: proposal.targetMint.toBase58(),
      buy: proposal.buy,
      dex: proposal.dex,
      createdAt: new Date(proposal.createdAt.toNumber() * 1000),
      deadline: new Date(proposal.deadline.toNumber() * 1000),
      nonce: proposal.nounce.toString(),
      executed: proposal.executed,
    };
  } catch (error) {
    console.error("Error fetching trade proposal:", error);
    throw error;
  }
}

/**
 * Get all proposals for a group
 */
export async function fetchAllGroupProposals(groupPDA: string) {
  try {
    const connection = getSolanaConnection();
    const dummyKeypair = Keypair.generate();
    const wallet = createWalletFromKeypair(dummyKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = getProgram(provider);

    const groupPubkey = new PublicKey(groupPDA);

    // Fetch all TradeProposal accounts for this group
    const proposals: any = await program.account['tradeProposal'].all([
      {
        memcmp: {
          offset: 8, // Discriminator size
          bytes: groupPubkey.toBase58(),
        }
      }
    ]);

    return proposals.map((p: any) => ({
      address: p.publicKey.toBase58(),
      group: p.account.group.toBase58(),
      proposer: p.account.proposer.toBase58(),
      proposerName: p.account.proposerName,
      voteCount: p.account.voteCount,
      amount: p.account.amount.toString(),
      targetMint: p.account.targetMint.toBase58(),
      buy: p.account.buy,
      createdAt: new Date(p.account.createdAt.toNumber() * 1000),
      deadline: new Date(p.account.deadline.toNumber() * 1000),
      executed: p.account.executed,
    }));
  } catch (error) {
    console.error("Error fetching group proposals:", error);
    throw error;
  }
}

export default {
  initializeGroup,
  joinGroup,
  exitGroup,
  addTrader,
  removeTrader,
  proposeTrade,
  vote,
  fetchGroupAccount,
  fetchMemberProfile,
  fetchTradeProposal,
  fetchAllGroupProposals,
  deriveGroupPDA,
  deriveMemberProfilePDA,
  deriveProposalPDA,
  deriveVotePDA,
  checkGroupExists,
  checkWalletBalance,
};

