/**
 * Blockchain Service Factory
 * Provides singleton instances of blockchain services based on address or type
 */

import { IBlockchainService } from "./interfaces/IBlockchainService";
import { BlockchainType } from "./types/BlockchainType";
import { BlockchainDetector } from "./utils/blockchainDetector";
import { BaseBlockchainService } from "../base/BaseBlockchainService";
import { SolanaBlockchainService } from "../solana/SolanaBlockchainService";

export class BlockchainServiceFactory {
  private static baseService: IBlockchainService | null = null;
  private static solanaService: IBlockchainService | null = null;

  /**
   * Get blockchain service by address or blockchain type
   * @param addressOrType Either a blockchain address (string) or BlockchainType enum
   * @returns IBlockchainService instance for the appropriate blockchain
   */
  static getService(
    addressOrType: string | BlockchainType
  ): IBlockchainService {
    let type: BlockchainType;

    // Check if it's a BlockchainType enum value (which could be "base" or "solana")
    if (
      addressOrType === BlockchainType.BASE ||
      addressOrType === BlockchainType.SOLANA
    ) {
      type = addressOrType as BlockchainType;
    } else if (typeof addressOrType === "string") {
      // It's a blockchain address, detect the type
      type = BlockchainDetector.detectBlockchainType(addressOrType);
    } else {
      throw new Error(`Invalid blockchain type or address: ${addressOrType}`);
    }

    switch (type) {
      case BlockchainType.BASE:
        if (!this.baseService) {
          this.baseService = new BaseBlockchainService();
        }
        return this.baseService;

      case BlockchainType.SOLANA:
        if (!this.solanaService) {
          this.solanaService = new SolanaBlockchainService();
        }
        return this.solanaService;

      default:
        throw new Error(`Unsupported blockchain type: ${type}`);
    }
  }

  /**
   * Convenience method to get service by detecting blockchain from address
   */
  static detectAndGetService(address: string): IBlockchainService {
    return this.getService(address);
  }

  /**
   * Reset singleton instances (useful for testing)
   */
  static reset(): void {
    this.baseService = null;
    this.solanaService = null;
  }
}
