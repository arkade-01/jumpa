import AjoGroup from "../models/ajoGroup";
import User from "../models/user";
import { Types } from "mongoose";
import * as solanaService from "./solanaService";

export interface CreateAjoParams {
  name: string;
  creator_id: number;
  telegram_chat_id: number;
  initial_capital: number;
  max_members: number;
  consensus_threshold?: number;
}

export interface JoinAjoParams {
  group_id: string;
  user_id: number;
  contribution?: number;
}

export interface CreatePollParams {
  group_id: string;
  creator_id: number;
  type: "trade" | "end_ajo";
  title: string;
  token_address?: string;
  token_symbol?: string;
  amount?: number;
  expires_hours?: number;
}

export interface VoteParams {
  group_id: string;
  poll_id: string;
  user_id: number;
  vote: boolean;
}

/**
 * Create a new Ajo group (both on-chain and in database)
 */
export async function createAjo(params: CreateAjoParams) {
  try {
    // Validate creator exists
    const creator = await User.findOne({ telegram_id: params.creator_id });
    if (!creator) {
      throw new Error("Creator not found. Please register first.");
    }

    // Validate parameters
    if (params.max_members < 2 || params.max_members > 100) {
      throw new Error("Max members must be between 2 and 100");
    }

    if (params.initial_capital < 0) {
      throw new Error("Initial capital must be non-negative");
    }

    const consensus_threshold = params.consensus_threshold || 67;
    if (consensus_threshold < 50 || consensus_threshold > 100) {
      throw new Error("Consensus threshold must be between 50% and 100%");
    }

    // Check if chat already has an ajo group
    const existingGroup = await AjoGroup.findOne({
      telegram_chat_id: params.telegram_chat_id,
    });
    if (existingGroup) {
      throw new Error("This chat already has an Ajo group");
    }

    // Initialize group on-chain first
    console.log("Initializing group on-chain...");
    let onChainResult;
    
    try {
      onChainResult = await solanaService.initializeGroup({
        telegramId: params.creator_id,
        groupName: params.name,
        adminName: creator.username,
        entryCapital: params.initial_capital,
        voteThreshold: consensus_threshold,
      });
      console.log(`On-chain group created: ${onChainResult.groupPDA}`);
    } catch (error) {
      console.error("Failed to create group on-chain:", error);
      
      // Check if the group was actually created despite the error
      const { checkGroupExists, deriveGroupPDA } = await import("./solanaService");
      const { decryptPrivateKey } = await import("../utils/encryption");
      const { Keypair } = await import("@solana/web3.js");
      
      try {
        const privateKeyHex = decryptPrivateKey(creator.private_key);
        const keypair = Keypair.fromSecretKey(Buffer.from(privateKeyHex, 'hex'));
        const signer = keypair.publicKey;
        
        const groupExists = await checkGroupExists(params.name, signer);
        if (groupExists) {
          const [groupPDA] = deriveGroupPDA(params.name, signer);
          throw new Error(
            `Group "${params.name}" already exists on-chain at ${groupPDA.toBase58()}. ` +
            `The transaction may have succeeded despite the error. ` +
            `Use /recover_group to sync it with the database.`
          );
        }
      } catch (checkError) {
        console.error("Error checking group existence:", checkError);
      }
      
      // Re-throw the original error
      throw new Error(`Failed to create group on-chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create the ajo group in database
    const ajoGroup = new AjoGroup({
      name: params.name,
      creator_id: params.creator_id,
      telegram_chat_id: params.telegram_chat_id,
      initial_capital: params.initial_capital,
      max_members: params.max_members,
      consensus_threshold: consensus_threshold,
      status: "active",
      members: [
        {
          user_id: params.creator_id,
          role: "trader", // Creator is automatically a trader
          contribution: 0, // Will be updated when they contribute
          joined_at: new Date(),
        },
      ],
      polls: [],
      trades: [],
      current_balance: 0,
      // Store on-chain addresses
      onchain_group_address: onChainResult.groupPDA,
      onchain_tx_signature: onChainResult.signature,
    });

    await ajoGroup.save();

    console.log(`Ajo group created: ${params.name} (ID: ${ajoGroup._id})`);
    console.log(`On-chain address: ${onChainResult.groupPDA}`);
    
    return ajoGroup;
  } catch (error) {
    console.error("Error creating ajo group:", error);
    throw error;
  }
}

/**
 * Join an existing Ajo group (both on-chain and in database)
 */
export async function joinAjo(params: JoinAjoParams) {
  try {
    // Validate user exists
    const user = await User.findOne({ telegram_id: params.user_id });
    if (!user) {
      throw new Error("User not found. Please register first.");
    }

    // Find the ajo group
    const ajoGroup = await AjoGroup.findById(params.group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    // Check if group is active
    if (ajoGroup.status !== "active") {
      throw new Error("This Ajo group is not accepting new members");
    }

    // Check if user is already a member
    const existingMember = ajoGroup.members.find(
      (member) => member.user_id === params.user_id
    );
    if (existingMember) {
      throw new Error("You are already a member of this Ajo group");
    }

    // Check if group has space
    if (ajoGroup.members.length >= ajoGroup.max_members) {
      throw new Error("This Ajo group is full");
    }

    // Get the group owner
    const owner = await User.findOne({ telegram_id: ajoGroup.creator_id });
    if (!owner) {
      throw new Error("Group owner not found");
    }

    // Join group on-chain
    if (ajoGroup.onchain_group_address) {
      console.log("Joining group on-chain...");
      let onChainResult;
      let alreadyMemberOnChain = false;
      
      try {
        onChainResult = await solanaService.joinGroup({
          telegramId: params.user_id,
          groupPDA: ajoGroup.onchain_group_address,
          ownerPubkey: owner.wallet_address,
          memberName: user.username,
        });
        console.log(`On-chain join successful: ${onChainResult.signature}`);
      } catch (error) {
        console.error("Failed to join group on-chain:", error);
        
        // Check if error is because user is already a member
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('already a member') || errorMessage.includes('Member profile exists')) {
          console.log('User is already a member on-chain, will update database only');
          alreadyMemberOnChain = true;
        } else {
          // For other errors, re-throw
          throw new Error(`Failed to join group on-chain: ${errorMessage}`);
        }
      }
    }

    // Add user as member in database
    ajoGroup.members.push({
      user_id: params.user_id,
      role: "member", // New members start as regular members
      contribution: params.contribution || 0,
      joined_at: new Date(),
    });

    await ajoGroup.save();

    console.log(`User ${params.user_id} joined ajo group ${params.group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error joining ajo group:", error);
    throw error;
  }
}

/**
 * Get Ajo group information
 */
export async function getAjoInfo(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    return ajoGroup;
  } catch (error) {
    console.error("Error getting ajo group info:", error);
    throw error;
  }
}

/**
 * Get Ajo group by telegram chat ID
 */
export async function getAjoByChatId(telegram_chat_id: number) {
  try {
    const ajoGroup = await AjoGroup.findOne({ telegram_chat_id });
    return ajoGroup;
  } catch (error) {
    console.error("Error getting ajo group by chat ID:", error);
    throw error;
  }
}

/**
 * Update Ajo group status
 */
export async function updateAjoStatus(
  group_id: string,
  status: "active" | "ended"
) {
  try {
    const ajoGroup = await AjoGroup.findByIdAndUpdate(
      group_id,
      { status },
      { new: true }
    );

    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    console.log(`Ajo group ${group_id} status updated to ${status}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error updating ajo group status:", error);
    throw error;
  }
}

/**
 * Get user's Ajo groups
 */
export async function getUserAjoGroups(user_id: number) {
  try {
    const ajoGroups = await AjoGroup.find({
      "members.user_id": user_id,
    });

    return ajoGroups;
  } catch (error) {
    console.error("Error getting user ajo groups:", error);
    throw error;
  }
}

/**
 * Check if user is member of ajo group
 */
export async function isUserMember(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      return false;
    }

    return ajoGroup.members.some((member) => member.user_id === user_id);
  } catch (error) {
    console.error("Error checking user membership:", error);
    return false;
  }
}

/**
 * Check if user is trader in ajo group
 */
export async function isUserTrader(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      return false;
    }

    const member = ajoGroup.members.find(
      (member) => member.user_id === user_id
    );
    return member ? member.role === "trader" : false;
  } catch (error) {
    console.error("Error checking user trader status:", error);
    return false;
  }
}

/**
 * Update member contribution
 */
export async function updateMemberContribution(
  group_id: string,
  user_id: number,
  contribution: number
) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    ajoGroup.members[memberIndex].contribution = contribution;

    // Update group balance
    ajoGroup.current_balance = ajoGroup.members.reduce(
      (total, member) => total + member.contribution,
      0
    );

    await ajoGroup.save();

    console.log(
      `Updated contribution for user ${user_id} in group ${group_id}`
    );
    return ajoGroup;
  } catch (error) {
    console.error("Error updating member contribution:", error);
    throw error;
  }
}

/**
 * Promote member to trader
 */
export async function promoteToTrader(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    ajoGroup.members[memberIndex].role = "trader";
    await ajoGroup.save();

    console.log(`User ${user_id} promoted to trader in group ${group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error promoting user to trader:", error);
    throw error;
  }
}

/**
 * Add trader on-chain
 */
export async function addTraderOnChain(group_id: string, trader_telegram_id: number, admin_telegram_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const trader = await User.findOne({ telegram_id: trader_telegram_id });
    if (!trader) {
      throw new Error("Trader not found");
    }

    if (ajoGroup.onchain_group_address) {
      console.log("Adding trader on-chain...");
      
      try {
        const result = await solanaService.addTrader({
          telegramId: admin_telegram_id,
          groupPDA: ajoGroup.onchain_group_address,
          traderPubkey: trader.wallet_address,
        });
        console.log(`Trader added on-chain: ${result.signature}`);
        return result;
      } catch (error) {
        console.error("Failed to add trader on-chain:", error);
        
        // Check if error is because trader is already added
        const errorMessage = error instanceof Error ? error.message : '';
        if (
          errorMessage.includes('already a trader') || 
          errorMessage.includes('Trader already exists') ||
          errorMessage.includes('AlreadyJoined') ||
          errorMessage.includes('Error Number: 6007')
        ) {
          console.log('Trader is already added on-chain, continuing with database update');
          return { success: true, signature: 'already_exists' };
        }
        
        // Re-throw other errors
        throw new Error(`Failed to add trader on-chain: ${errorMessage}`);
      }
    }

    throw new Error("Group has no on-chain address");
  } catch (error) {
    console.error("Error adding trader on-chain:", error);
    throw error;
  }
}

/**
 * Remove trader on-chain
 */
export async function removeTraderOnChain(group_id: string, trader_telegram_id: number, admin_telegram_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const trader = await User.findOne({ telegram_id: trader_telegram_id });
    if (!trader) {
      throw new Error("Trader not found");
    }

    if (ajoGroup.onchain_group_address) {
      console.log("Removing trader on-chain...");
      const result = await solanaService.removeTrader({
        telegramId: admin_telegram_id,
        groupPDA: ajoGroup.onchain_group_address,
        traderPubkey: trader.wallet_address,
      });
      console.log(`Trader removed on-chain: ${result.signature}`);
      return result;
    }

    throw new Error("Group has no on-chain address");
  } catch (error) {
    console.error("Error removing trader on-chain:", error);
    throw error;
  }
}

/**
 * Create trade proposal on-chain
 */
export interface CreateTradeProposalParams {
  group_id: string;
  proposer_telegram_id: number;
  name: string;
  token_mint: string;
  token_account: string;
  amount: number;
  buy: boolean; // true for buy, false for sell
}

export async function createTradeProposal(params: CreateTradeProposalParams) {
  try {
    const ajoGroup = await AjoGroup.findById(params.group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const proposer = await User.findOne({ telegram_id: params.proposer_telegram_id });
    if (!proposer) {
      throw new Error("Proposer not found");
    }

    const owner = await User.findOne({ telegram_id: ajoGroup.creator_id });
    if (!owner) {
      throw new Error("Group owner not found");
    }

    // Check if user is a trader
    const isTrader = await isUserTrader(params.group_id, params.proposer_telegram_id);
    if (!isTrader) {
      throw new Error("Only traders can create trade proposals");
    }

    if (!ajoGroup.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    // Generate nonce (using timestamp + random number)
    const nonce = Date.now() + Math.floor(Math.random() * 1000);

    console.log("Creating trade proposal on-chain...");
    const result = await solanaService.proposeTrade({
      telegramId: params.proposer_telegram_id,
      groupPDA: ajoGroup.onchain_group_address,
      ownerPubkey: owner.wallet_address,
      name: params.name,
      nonce: nonce,
      amount: params.amount,
      buy: params.buy,
      tokenAccount: params.token_account,
      mintAccount: params.token_mint,
    });

    console.log(`Trade proposal created on-chain: ${result.proposalPDA}`);

    // Store proposal info in database for quick access
    ajoGroup.polls.push({
      id: result.proposalPDA,
      creator_id: params.proposer_telegram_id,
      type: "trade",
      title: params.name,
      token_address: params.token_mint,
      token_symbol: params.name.split(" ")[0], // Extract token symbol from name
      amount: params.amount,
      status: "open",
      votes: [],
      created_at: new Date(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    });

    await ajoGroup.save();

    return {
      success: true,
      proposalPDA: result.proposalPDA,
      signature: result.signature,
      group: ajoGroup,
    };
  } catch (error) {
    console.error("Error creating trade proposal:", error);
    throw error;
  }
}

/**
 * Fetch on-chain group state and sync with database
 */
export async function syncGroupFromChain(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    if (!ajoGroup.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    console.log("Fetching on-chain group state...");
    const onChainData = await solanaService.fetchGroupAccount(ajoGroup.onchain_group_address);

    console.log("On-chain group data:", onChainData);

    // Sync trader roles from on-chain to database
    const onChainTraders = new Set(onChainData.traders);
    let syncedCount = 0;
    
    for (const member of ajoGroup.members) {
      const user = await User.findOne({ telegram_id: member.user_id });
      if (!user) continue;
      
      const isTraderOnChain = onChainTraders.has(user.wallet_address);
      const isTraderInDB = member.role === "trader";
      
      // Fix mismatch
      if (isTraderOnChain && !isTraderInDB) {
        member.role = "trader";
        syncedCount++;
        console.log(`Synced user ${member.user_id} (${user.username}): promoted to trader`);
      } else if (!isTraderOnChain && isTraderInDB) {
        member.role = "member";
        syncedCount++;
        console.log(`Synced user ${member.user_id} (${user.username}): demoted to member`);
      }
    }
    
    if (syncedCount > 0) {
      await ajoGroup.save();
      console.log(`Synced ${syncedCount} member roles from on-chain state`);
    }

    return {
      database: ajoGroup,
      onChain: onChainData,
      syncedRoles: syncedCount,
    };
  } catch (error) {
    console.error("Error syncing group from chain:", error);
    throw error;
  }
}

/**
 * Fetch all proposals for a group from on-chain
 */
export async function fetchGroupProposals(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    if (!ajoGroup.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    console.log("Fetching on-chain proposals...");
    const proposals = await solanaService.fetchAllGroupProposals(ajoGroup.onchain_group_address);

    return proposals;
  } catch (error) {
    console.error("Error fetching group proposals:", error);
    throw error;
  }
}

/**
 * Remove member from ajo group (exit on-chain and remove from database)
 */
export async function removeMember(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    // Don't allow removing the creator
    if (ajoGroup.creator_id === user_id) {
      throw new Error("Cannot remove the group creator");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    // Exit group on-chain
    if (ajoGroup.onchain_group_address) {
      const owner = await User.findOne({ telegram_id: ajoGroup.creator_id });
      if (owner) {
        console.log("Exiting group on-chain...");
        try {
          await solanaService.exitGroup({
            telegramId: user_id,
            groupName: ajoGroup.name,
            ownerPubkey: owner.wallet_address,
          });
        } catch (error) {
          console.error("On-chain exit failed:", error);
          // Continue with off-chain removal even if on-chain fails
        }
      }
    }

    // Remove member and update balance
    const memberContribution = ajoGroup.members[memberIndex].contribution;
    ajoGroup.members.splice(memberIndex, 1);
    ajoGroup.current_balance -= memberContribution;

    await ajoGroup.save();

    console.log(`User ${user_id} removed from group ${group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error removing member:", error);
    throw error;
  }
}
