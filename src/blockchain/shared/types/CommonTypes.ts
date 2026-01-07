/**
 * Common Types for Cross-Chain Operations
 * These types provide a unified interface across different blockchains
 */

import { BlockchainType } from "./BlockchainType";

/**
 * Group states normalized across blockchains
 */
export enum GroupState {
  OPEN = "open",
  TRADING = "trading",
  CLOSED = "closed",
  PAUSED = "paused",
  LOCKED = "locked"
}

/**
 * Generic blockchain response wrapper
 */
export interface BlockchainResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  transactionHash?: string;
  blockNumber?: number;  // Base only
  slot?: number;         // Solana only
}

/**
 * Normalized group information across blockchains
 */
export interface GroupInfo {
  groupAddress: string;
  name: string;
  isPrivate: boolean;
  state: GroupState;
  members: string[];
  traders: string[];
  blacklist?: string[];
  minimumDeposit: number;        // Normalized to decimal (not wei/lamports)
  totalContributions: number;     // Normalized to decimal
  currency: "ETH" | "SOL";
  createdAt: Date;
  blockchain: BlockchainType;

  // Optional blockchain-specific fields
  maxSlippagePercentage?: number;  // Base only
  maxSwapPercentage?: number;      // Base only
  exitPenaltyPercentage?: number;  // Solana only
  lockPeriodDays?: number;         // Solana only
}

/**
 * Member information normalized across blockchains
 */
export interface MemberInfo {
  address: string;
  contribution: number;            // Normalized to decimal
  joinedAt: Date;
  isApproved?: boolean;
  isTrader?: boolean;
  isBlacklisted?: boolean;
}

/**
 * Transaction result normalized across blockchains
 */
export interface TransactionResult {
  success: boolean;
  transactionHash: string;
  blockNumber?: number;            // Base only
  slot?: number;                   // Solana only
  explorerUrl: string;
}

/**
 * Group creation data
 */
export interface GroupData {
  groupAddress: string;
  name: string;
  isPrivate: boolean;
  owner: string;
  hash?: string;
  timestamp?: string;
}

/**
 * Join group data
 */
export interface JoinData {
  member: string;
  contribution: string | number;
  timestamp?: string;
  hash?: string;
}

/**
 * Leave group data
 */
export interface LeaveData {
  member: string;
  withdrawal: string | number;
  contribution: string | number;
  timestamp?: string;
  hash?: string;
}
export interface BlacklistData {
  address: string;
  blacklistedBy: string;
  timestamp: string;
  hash: string;
  blockNumber: number;
}
/**
 * Deposit data
 */
export interface DepositData {
  member: string;
  token?: string;
  amount: string | number;
  newTotal: string | number;
  timestamp?: string;
  hash?: string;
}

/**
 * Close group data
 */
export interface CloseData {
  closedBy: string;
  finalBalance?: string | number;
  totalMembers?: number;
  timestamp?: string;
  hash?: string;
}
