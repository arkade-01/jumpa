/**
 * Base Blockchain Service
 * Implements IBlockchainService for Base (EVM) blockchain
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

// Import existing Base blockchain functions
import { createBaseGroup } from "./createGroup";
import { fetchBaseGroupInfo } from "./fetchGroupInfo";
import { JoinBaseGroup } from "./joinGroup";
import { LeaveBaseGroup } from "./leaveGroup";
import { DepositBaseGroup } from "./groupDeposit";
import { closeGroup } from "./closeGroup";
import { addToBlacklist } from "./addToBlacklist";

export class BaseBlockchainService implements IBlockchainService {
  // ===== METADATA =====

  getBlockchainType(): BlockchainType {
    return BlockchainType.BASE;
  }

  getNativeCurrency(): string {
    return BlockchainDetector.getNativeCurrency(BlockchainType.BASE);
  }

  validateAddress(address: string): boolean {
    return BlockchainDetector.validateAddress(address, BlockchainType.BASE);
  }

  getDisplayName(): string {
    return BlockchainDetector.getDisplayName(BlockchainType.BASE);
  }

  // ===== GROUP OPERATIONS =====

  async createGroup(
    ctx: Context,
    name: string,
    isPrivate: boolean
  ): Promise<BlockchainResponse<GroupData>> {
    try {
      // Base uses inverted logic: type=true means public, type=false means private
      // We need to invert isPrivate to match the contract
      const result = await createBaseGroup(ctx, name, !isPrivate);

      if (!result) {
        return {
          success: false,
          error: "Failed to create group - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            groupAddress: result.data.groupAddress,
            name: result.data.name || name,
            isPrivate: result.data.isPrivate,
            owner: result.data.owner,
            hash: result.data.hash,
            timestamp: result.data.timestamp
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }

  async fetchGroupInfo(groupAddress: string): Promise<BlockchainResponse<GroupInfo>> {
    try {
      const result = await fetchBaseGroupInfo(groupAddress);

      if (!result) {
        return {
          success: false,
          error: "Failed to fetch group info - no response"
        };
      }

      if (result.success && result.data) {
        const normalizedInfo = ResponseMapper.normalizeBaseGroupInfo(result.data);
        return {
          success: true,
          data: normalizedInfo
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }

  async closeGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<CloseData>> {
    try {
      const result = await closeGroup(ctx, groupAddress);

      if (!result) {
        return {
          success: false,
          error: "Failed to close group - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            closedBy: result.data.closedBy,
            finalBalance: result.data.finalBalance,
            totalMembers: result.data.totalMembers,
            timestamp: result.data.timestamp,
            hash: result.data.hash
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }

  // ===== MEMBER OPERATIONS =====

  async joinGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<JoinData>> {
    try {
      const result = await JoinBaseGroup(ctx, groupAddress);

      if (!result) {
        return {
          success: false,
          error: "Failed to join group - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            member: result.data.member,
            contribution: result.data.contribution,
            timestamp: result.data.timestamp,
            hash: result.data.hash
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }

  async leaveGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<LeaveData>> {
    try {
      const result = await LeaveBaseGroup(ctx, groupAddress);

      if (!result) {
        return {
          success: false,
          error: "Failed to leave group - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            member: result.data.member,
            withdrawal: result.data.withdrawal,
            contribution: result.data.contribution,
            timestamp: result.data.timestamp,
            hash: result.data.hash
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }

  async addToBlacklist(ctx: Context, groupAddress: string, addressToBlacklist: string): Promise<BlockchainResponse<BlacklistData>> {
    try {
      const result = await addToBlacklist(ctx, groupAddress, addressToBlacklist);

      if (!result) {
        return {
          success: false,
          error: "Failed to add to blacklist - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            address: result.data.address,
            blacklistedBy: result.data.blacklistedBy,
            timestamp: result.data.timestamp,
            hash: result.data.hash,
            blockNumber: result.data.blockNumber
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
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
      const result = await DepositBaseGroup(ctx, groupAddress, amount);

      if (!result) {
        return {
          success: false,
          error: "Failed to deposit - no response"
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            member: result.data.member,
            token: result.data.token,
            amount: result.data.amount,
            newTotal: result.data.newTotal,
            timestamp: result.data.timestamp,
            hash: result.data.hash
          },
          transactionHash: result.data.hash,
          blockNumber: result.data.blockNumber
        };
      }

      return {
        success: false,
        error: result.data || "Unknown error occurred"
      };
    } catch (error) {
      return {
        success: false,
        error: BlockchainErrorHandler.handle(error, BlockchainType.BASE)
      };
    }
  }
}
