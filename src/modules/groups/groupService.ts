import Group from "@database/models/group";
import User from "@database/models/user";
import {
  createGroup as createGroupOnChain,
  joinGroup as joinGroupOnChain,
  exitGroup as exitGroupOnChain,
  addTrader as addTraderOnChain,
  removeTrader as removeTraderOnChain,
  fetchGroupAccount,
  deriveGroupPDA,
  checkGroupExists
} from "@blockchain/solana";

export interface CreateGroupParams {
  name: string;
  creator_id: number;
  telegram_chat_id: number;
  is_private: boolean;
  max_members: number;
}

export interface JoinGroupParams {
  group_id: string;
  user_id: number;
  contribution?: number;
}

/**
 * Create a new group (both on-chain and in database)
 */
export async function createGroup(params: CreateGroupParams) {
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

    // Check if chat already has a group
    const existingGroup = await Group.findOne({
      telegram_chat_id: params.telegram_chat_id,
    });
    if (existingGroup) {
      throw new Error("This chat already has a group");
    }

    // Initialize group on-chain first
    console.log("Initializing group on-chain...");
    let onChainResult;

    try {
      onChainResult = await createGroupOnChain({
        telegramId: params.creator_id,
        groupName: params.name,
        adminName: creator.username,
        isPrivate: params.is_private,
      });
      console.log(`On-chain group created: ${onChainResult.groupPDA}`);
    } catch (error) {
      console.error("Failed to create group on-chain:", error);

      // Check if the group was actually created despite the error
      const { decryptPrivateKey } = await import("@shared/utils/encryption");
      const { Keypair } = await import("@solana/web3.js");

      try {
        const privateKeyHex = decryptPrivateKey(creator.solanaWallets[0].encryptedPrivateKey);
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

    // Create the group in database
    const group = new Group({
      name: params.name,
      creator_id: params.creator_id,
      telegram_chat_id: params.telegram_chat_id,
      is_private: params.is_private,
      max_members: params.max_members,
      status: "active",
      members: [
        {
          user_id: params.creator_id,
          role: "trader", // Creator is automatically a trader
          contribution: 0,
          joined_at: new Date(),
        },
      ],
      polls: [],
      trades: [],
      current_balance: 0,
      onchain_group_address: onChainResult.groupPDA,
      onchain_tx_signature: onChainResult.signature,
    });

    await group.save();

    console.log(`Group created: ${params.name} (ID: ${group._id})`);
    console.log(`On-chain address: ${onChainResult.groupPDA}`);

    return group;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
}

/**
 * Join an existing group (both on-chain and in database)
 */
export async function joinGroup(params: JoinGroupParams) {
  try {
    // Validate user exists
    const user = await User.findOne({ telegram_id: params.user_id });
    if (!user) {
      throw new Error("User not found. Please register first.");
    }

    // Find the group
    const group = await Group.findById(params.group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check if group is active
    if (group.status !== "active") {
      throw new Error("This group is not accepting new members");
    }

    // Check if user is already a member
    const existingMember = group.members.find(
      (member) => member.user_id === params.user_id
    );
    if (existingMember) {
      throw new Error("You are already a member of this group");
    }

    // Check if group has space
    if (group.members.length >= group.max_members) {
      throw new Error("This group is full");
    }

    // Get the group owner
    const owner = await User.findOne({ telegram_id: group.creator_id });
    if (!owner) {
      throw new Error("Group owner not found");
    }

    // Join group on-chain first (if group has on-chain address)
    let onChainSuccess = false;
    if (group.onchain_group_address) {
      console.log("Joining group on-chain...");

      try {
        const onChainResult = await joinGroupOnChain({
          telegramId: params.user_id,
          groupPDA: group.onchain_group_address,
          ownerPubkey: owner.solanaWallets[0].address,
          memberName: user.username,
        });
        console.log(`On-chain join successful: ${onChainResult.signature}`);
        onChainSuccess = true;
      } catch (error) {
        console.error("Failed to join group on-chain:", error);

        // Check if error is because user is already a member
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('already a member') || errorMessage.includes('Member profile exists')) {
          console.log('User is already a member on-chain, will update database');
          onChainSuccess = true; // Allow database update since they're already on-chain
        } else {
          // For other errors, throw and don't update database
          throw new Error(`Failed to join group on-chain: ${errorMessage}`);
        }
      }
    } else {
      // No on-chain address, so we can proceed with database-only
      onChainSuccess = true;
    }

    // Only add to database if on-chain join was successful (or no on-chain address)
    if (onChainSuccess) {
      // Add user as member in database
      group.members.push({
        user_id: params.user_id,
        role: "member",
        contribution: params.contribution || 0,
        joined_at: new Date(),
      });

      await group.save();

      console.log(`User ${params.user_id} joined group ${params.group_id}`);
      return group;
    } else {
      throw new Error("Failed to join group - on-chain transaction did not succeed");
    }
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
}

/**
 * Exit a group (both on-chain and in database)
 */
export async function exitGroup(group_id: string, user_id: number) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    // Don't allow removing the creator
    if (group.creator_id === user_id) {
      throw new Error("Cannot remove the group creator");
    }

    const memberIndex = group.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    // Exit group on-chain
    if (group.onchain_group_address) {
      const owner = await User.findOne({ telegram_id: group.creator_id });
      if (owner) {
        console.log("Exiting group on-chain...");
        try {
          await exitGroupOnChain({
            telegramId: user_id,
            groupName: group.name,
            ownerPubkey: owner.solanaWallets[0].address,
          });
        } catch (error) {
          console.error("On-chain exit failed:", error);
          // Continue with database removal even if on-chain fails
        }
      }
    }

    // Remove member and update balance
    const memberContribution = group.members[memberIndex].contribution;
    group.members.splice(memberIndex, 1);
    group.current_balance -= memberContribution;

    await group.save();

    console.log(`User ${user_id} removed from group ${group_id}`);
    return group;
  } catch (error) {
    console.error("Error exiting group:", error);
    throw error;
  }
}

/**
 * Get group information
 */
export async function getGroupInfo(group_id: string) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    return group;
  } catch (error) {
    console.error("Error getting group info:", error);
    throw error;
  }
}

/**
 * Get group by telegram chat ID
 */
export async function getGroupByChatId(telegram_chat_id: number) {
  try {
    const group = await Group.findOne({ telegram_chat_id });
    return group;
  } catch (error) {
    console.error("Error getting group by chat ID:", error);
    throw error;
  }
}

/**
 * Update group status
 */
export async function updateGroupStatus(
  group_id: string,
  status: "active" | "ended"
) {
  try {
    const group = await Group.findByIdAndUpdate(
      group_id,
      { status },
      { new: true }
    );

    if (!group) {
      throw new Error("Group not found");
    }

    console.log(`Group ${group_id} status updated to ${status}`);
    return group;
  } catch (error) {
    console.error("Error updating group status:", error);
    throw error;
  }
}

/**
 * Get user's groups
 */
export async function getUserGroups(user_id: number) {
  try {
    const groups = await Group.find({
      "members.user_id": user_id,
    });

    return groups;
  } catch (error) {
    console.error("Error getting user groups:", error);
    throw error;
  }
}

/**
 * Check if user is member of group
 */
export async function isUserMember(group_id: string, user_id: number) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      return false;
    }

    return group.members.some((member) => member.user_id === user_id);
  } catch (error) {
    console.error("Error checking user membership:", error);
    return false;
  }
}

/**
 * Check if user is trader in group
 */
export async function isUserTrader(group_id: string, user_id: number) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      return false;
    }

    const member = group.members.find(
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
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    const memberIndex = group.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    group.members[memberIndex].contribution = contribution;

    // Update group balance
    group.current_balance = group.members.reduce(
      (total, member) => total + member.contribution,
      0
    );

    await group.save();

    console.log(
      `Updated contribution for user ${user_id} in group ${group_id}`
    );
    return group;
  } catch (error) {
    console.error("Error updating member contribution:", error);
    throw error;
  }
}

/**
 * Promote member to trader (database only, call addTraderToGroup for on-chain)
 */
export async function promoteToTrader(group_id: string, user_id: number) {
  console.log("promote to trader called")
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    const memberIndex = group.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    group.members[memberIndex].role = "trader";
    await group.save();

    console.log(`User ${user_id} promoted to trader in group ${group_id}`);
    return group;
  } catch (error) {
    console.error("Error promoting user to trader:", error);
    throw error;
  }
}

/**
 * Add trader on-chain and update database
 */
export async function addTraderToGroup(
  group_id: string,
  trader_telegram_id: number,
  admin_telegram_id: number
) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    const trader = await User.findOne({ telegram_id: trader_telegram_id });
    if (!trader) {
      throw new Error("Trader not found");
    }

    console.log("Trader found:", {
      telegram_id: trader.telegram_id,
      username: trader.username,
      hasWallets: !!trader.solanaWallets,
      walletCount: trader.solanaWallets?.length || 0,
      firstWalletAddress: trader.solanaWallets?.[0]?.address || 'none'
    });

    // Validate trader has a Solana wallet
    if (!trader.solanaWallets || trader.solanaWallets.length === 0) {
      throw new Error(
        `User @${trader.username || trader_telegram_id} doesn't have a Solana wallet. ` +
        `They need to use /start to create a wallet first.`
      );
    }

    if (!trader.solanaWallets[0].address) {
      throw new Error(
        `User @${trader.username || trader_telegram_id} has an invalid wallet. ` +
        `Please contact support.`
      );
    }

    if (!group.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    console.log("Adding trader on-chain...");
    console.log("Trader wallet address:", trader.solanaWallets[0].address);

    try {
      const result = await addTraderOnChain({
        telegramId: admin_telegram_id,
        groupPDA: group.onchain_group_address,
        traderPubkey: trader.solanaWallets[0].address,
      });
      console.log(`Trader added on-chain: ${result.signature}`);

      // Update database
      await promoteToTrader(group_id, trader_telegram_id);

      return result;
    } catch (error) {
      console.error("Failed to add trader on-chain:", error);

      // Check if error is because trader is already added
      const errorMessage = error instanceof Error ? error.message : '';

      // Handle case where user hasn't joined the group on-chain
      if (
        errorMessage.includes('AccountNotInitialized') ||
        errorMessage.includes('trader_profile')
      ) {
        throw new Error(
          `User hasn't joined the group on-chain yet. ` +
          `Ask them to leave the group (/leave_group) and rejoin using (/join ${group_id}) to sync their on-chain profile, ` +
          `then try promoting them again.`
        );
      }

      if (
        errorMessage.includes('already a trader') ||
        errorMessage.includes('Trader already exists') ||
        errorMessage.includes('AlreadyJoined') ||
        errorMessage.includes('Error Number: 6007')
      ) {
        console.log('Trader is already added on-chain, updating database only');
        await promoteToTrader(group_id, trader_telegram_id);
        return { success: true, signature: 'already_exists' };
      }

      // Re-throw other errors
      throw new Error(`Failed to add trader on-chain: ${errorMessage}`);
    }
  } catch (error) {
    console.error("Error adding trader to group:", error);
    throw error;
  }
}

/**
 * Remove trader on-chain and update database
 */
export async function removeTraderFromGroup(
  group_id: string,
  trader_telegram_id: number,
  admin_telegram_id: number
) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    const trader = await User.findOne({ telegram_id: trader_telegram_id });
    if (!trader) {
      throw new Error("Trader not found");
    }

    // Validate trader has a Solana wallet
    if (!trader.solanaWallets || trader.solanaWallets.length === 0) {
      throw new Error(
        `User @${trader.username || trader_telegram_id} doesn't have a Solana wallet.`
      );
    }

    if (!trader.solanaWallets[0].address) {
      throw new Error(
        `User @${trader.username || trader_telegram_id} has an invalid wallet.`
      );
    }

    if (!group.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    console.log("Removing trader on-chain...");
    const result = await removeTraderOnChain({
      telegramId: admin_telegram_id,
      groupPDA: group.onchain_group_address,
      traderPubkey: trader.solanaWallets[0].address,
    });
    console.log(`Trader removed on-chain: ${result.signature}`);

    // Update database - demote to member
    const memberIndex = group.members.findIndex(
      (member) => member.user_id === trader_telegram_id
    );
    if (memberIndex !== -1) {
      group.members[memberIndex].role = "member";
      await group.save();
    }

    return result;
  } catch (error) {
    console.error("Error removing trader from group:", error);
    throw error;
  }
}

/**
 * Fetch on-chain group state and sync with database
 */
export async function syncGroupFromChain(group_id: string) {
  try {
    const group = await Group.findById(group_id);
    if (!group) {
      throw new Error("Group not found");
    }

    if (!group.onchain_group_address) {
      throw new Error("Group has no on-chain address");
    }

    console.log("Fetching on-chain group state...");
    const onChainData = await fetchGroupAccount(group.onchain_group_address);

    console.log("On-chain group data:", onChainData);

    // Sync trader roles from on-chain to database
    const onChainTraders = new Set(onChainData.traders);
    let syncedCount = 0;

    for (const member of group.members) {
      const user = await User.findOne({ telegram_id: member.user_id });
      if (!user) continue;

      const isTraderOnChain = onChainTraders.has(user.solanaWallets[0].address);
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
      await group.save();
      console.log(`Synced ${syncedCount} member roles from on-chain state`);
    }

    return {
      database: group,
      onChain: onChainData,
      syncedRoles: syncedCount,
    };
  } catch (error) {
    console.error("Error syncing group from chain:", error);
    throw error;
  }
}
