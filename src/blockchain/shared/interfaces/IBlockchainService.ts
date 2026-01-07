/**
 * Blockchain Service Interface
 * Defines the contract that all blockchain implementations must follow
 */

import { Context } from "telegraf";
import { BlockchainType } from "../types/BlockchainType";
import {
  BlockchainResponse,
  GroupData,
  GroupInfo,
  JoinData,
  LeaveData,
  DepositData,
  CloseData,
  BlacklistData
} from "../types/CommonTypes";

export interface IBlockchainService {
  // ===== METADATA =====

  /**
   * Get the blockchain type for this service
   */
  getBlockchainType(): BlockchainType;

  /**
   * Get the native currency symbol (ETH, SOL, etc.)
   */
  getNativeCurrency(): string;

  /**
   * Validate if an address is valid for this blockchain
   */
  validateAddress(address: string): boolean;

  /**
   * Get the display name of the blockchain
   */
  getDisplayName(): string;

  // ===== GROUP OPERATIONS =====

  /**
   * Create a new group on the blockchain
   * @param ctx Telegram context
   * @param name Group name
   * @param isPrivate Whether the group requires approval
   */
  createGroup(
    ctx: Context,
    name: string,
    isPrivate: boolean
  ): Promise<BlockchainResponse<GroupData>>;

  /**
   * Fetch group information from the blockchain
   * @param groupAddress The on-chain address of the group
   */
  fetchGroupInfo(groupAddress: string): Promise<BlockchainResponse<GroupInfo>>;

  /**
   * Close a group permanently
   * @param ctx Telegram context
   * @param groupAddress The on-chain address of the group
   */
  closeGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<CloseData>>;

  // ===== MEMBER OPERATIONS =====

  /**
   * Join an existing group
   * @param ctx Telegram context
   * @param groupAddress The on-chain address of the group to join
   */
  joinGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<JoinData>>;

  /**
   * Leave a group and withdraw funds
   * @param ctx Telegram context
   * @param groupAddress The on-chain address of the group to leave
   */
  leaveGroup(
    ctx: Context,
    groupAddress: string
  ): Promise<BlockchainResponse<LeaveData>>;

  /**
   * Add an address to the group's blacklist
   * @param ctx Telegram context
   * @param groupAddress The on-chain address of the group
   * @param addressToBlacklist The address to add to blacklist
   */
  // addToBlacklist(
  //   ctx: Context,
  //   groupAddress: string,
  //   addressToBlacklist: string
  // ): Promise<BlockchainResponse<BlacklistData>>;

  // ===== FINANCIAL OPERATIONS =====

  /**
   * Deposit funds to a group
   * @param ctx Telegram context
   * @param groupAddress The on-chain address of the group
   * @param amount Amount to deposit (in native currency)
   */
  deposit(
    ctx: Context,
    groupAddress: string,
    amount: number
  ): Promise<BlockchainResponse<DepositData>>;
}
