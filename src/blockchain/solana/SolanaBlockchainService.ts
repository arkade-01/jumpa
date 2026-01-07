/**
 * Solana Blockchain Service
 * Implements IBlockchainService for Solana blockchain
 */

import { Context } from "telegraf";
import { IBlockchainService } from "../shared/interfaces/IBlockchainService";
import { BlockchainType } from "../shared/types/BlockchainType";
import {
  BlockchainResponse,
  GroupData,
  GroupInfo,
  JoinData,
  LeaveData,
  DepositData,
  CloseData,
  BlacklistData
} from "../shared/types/CommonTypes";
import { BlockchainDetector, ResponseMapper, BlockchainErrorHandler } from "../shared/utils";
import User from "@core/database/models/user";

// Import existing Solana blockchain functions
import { createGroup, CreateGroupParams } from "./createGroup";
import { joinGroup, JoinGroupParams } from "./joinGroup";
import { exitGroup, ExitGroupParams } from "./exitGroup";
import { closeGroup, CloseGroupParams } from "./closeGroup";
import { deposit, DepositParams } from "./deposit";
import { fetchGroupAccount } from "./fetchData";
import { deriveGroupPDA } from "./utils";
import { addToBlacklist } from "./manageBlacklist";

export class SolanaBlockchainService implements IBlockchainService {
  // ===== METADATA =====

  getBlockchainType(): BlockchainType {
    return BlockchainType.SOLANA;
  }

  getNativeCurrency(): string {
    return BlockchainDetector.getNativeCurrency(BlockchainType.SOLANA);
  }

  validateAddress(address: string): boolean {
    return BlockchainDetector.validateAddress(address, BlockchainType.SOLANA);
  }

  getDisplayName(): string {
    return BlockchainDetector.getDisplayName(BlockchainType.SOLANA);
  }

  // ===== GROUP OPERATIONS =====

  async createGroup(
    ctx: Context,
    name: string,
    isPrivate: boolean
  ): Promise<BlockchainResponse<GroupData>> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        return {
          success: false,
          error: "Unable to identify user"
        };
      }

      const params: CreateGroupParams = {
        telegramId: userId,
        groupName: name,
        adminName: username,
        isPrivate: isPrivate
      };

      const result = await createGroup(params);

      return {
        success: true,
        data: {
          groupAddress: result.groupPDA,
          name: name,
          isPrivate: isPrivate,
          owner: username,
          hash: result.signature
        },
        transactionHash: result.signature
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }

  async fetchGroupInfo(groupAddress: string): Promise<BlockchainResponse<GroupInfo>> {
    try {
      const groupData = await fetchGroupAccount(groupAddress);

      const normalizedInfo = ResponseMapper.normalizeSolanaGroupInfo({
        ...groupData,
        groupAddress: groupAddress,
        publicKey: groupAddress
      });

      return {
        success: true,
        data: normalizedInfo
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }

  async closeGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<CloseData>> {
    try {
      const userId = ctx.from?.id;

      if (!userId) {
        return {
          success: false,
          error: "Unable to identify user"
        };
      }

      const params: CloseGroupParams = {
        telegramId: userId,
        groupPDA: groupAddress
      };

      const result = await closeGroup(params);

      return {
        success: true,
        data: {
          closedBy: ctx.from?.username || "Unknown",
          hash: result.signature
        },
        transactionHash: result.signature
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }

  // ===== MEMBER OPERATIONS =====

  async joinGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<JoinData>> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        return {
          success: false,
          error: "Unable to identify user"
        };
      }

      // Fetch group data to get owner info
      const groupData = await fetchGroupAccount(groupAddress);

      const params: JoinGroupParams = {
        telegramId: userId,
        groupPDA: groupAddress,
        ownerPubkey: groupData.owner,
        memberName: username
      };

      const result = await joinGroup(params);

      // Get user's wallet address
      const user = await User.findOne({ telegram_id: userId });
      const memberAddress = user?.solanaWallets[0]?.address || "Unknown";

      return {
        success: true,
        data: {
          member: memberAddress,
          contribution: "0", // Solana doesn't require upfront contribution on join
          hash: result.signature
        },
        transactionHash: result.signature
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }

  async leaveGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<LeaveData>> {
    try {
      const userId = ctx.from?.id;

      if (!userId) {
        return {
          success: false,
          error: "Unable to identify user"
        };
      }

      // Fetch group data to get owner and group name
      const groupData = await fetchGroupAccount(groupAddress);

      const params: ExitGroupParams = {
        telegramId: userId,
        groupName: groupData.name,
        ownerPubkey: groupData.owner
      };

      const result = await exitGroup(params);

      // Get user's wallet address
      const user = await User.findOne({ telegram_id: userId });
      const memberAddress = user?.solanaWallets[0]?.address || "Unknown";

      return {
        success: true,
        data: {
          member: memberAddress,
          withdrawal: "0", // Will be calculated on-chain
          contribution: "0", // Will be calculated on-chain
          hash: result.signature
        },
        transactionHash: result.signature
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }

  // ===== FINANCIAL OPERATIONS =====

  async deposit(
    ctx: Context,
    groupAddress: string,
    amount: number
  ): Promise<BlockchainResponse<DepositData>> {
    try {
      const userId = ctx.from?.id;

      if (!userId) {
        return {
          success: false,
          error: "Unable to identify user"
        };
      }

      const params: DepositParams = {
        telegramId: userId,
        groupPDA: groupAddress,
        amount: amount
      };

      const result = await deposit(params);

      // Get user's wallet address
      const user = await User.findOne({ telegram_id: userId });
      const memberAddress = user?.solanaWallets[0]?.address || "Unknown";

      return {
        success: true,
        data: {
          member: memberAddress,
          amount: result.amount.toString(),
          newTotal: result.amountLamports.toString(),
          hash: result.signature
        },
        transactionHash: result.signature
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.SOLANA)
      };
    }
  }
}
