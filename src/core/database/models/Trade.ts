import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  telegram_id: number;
  type: "BUY" | "SELL";
  chain: "solana" | "base" | "celo";
  tokenAddress: string;
  symbol: string;
  amountNative: number;
  amountUsd: number;
  tokenAmount: number;
  priceNative: number;
  priceUsd: number;
  slippage_used: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  txHash: string;
  feeNative: number;
  feeUsd: number;
  walletAddress: string;
  isGroupTrade: boolean;
  groupId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema: Schema = new Schema(
  {
    telegram_id: { type: Number, required: true, index: true },
    type: { type: String, enum: ["BUY", "SELL"], required: true },
    chain: { type: String, enum: ["solana", "base", "celo"], required: true },
    tokenAddress: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    amountNative: { type: Number, required: true },
    amountUsd: { type: Number, required: true },
    tokenAmount: { type: Number, required: true },
    priceNative: { type: Number, required: true },
    priceUsd: { type: Number, required: true },
    slippage_used: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    txHash: { type: String, required: true, unique: true, index: true },
    feeNative: { type: Number, required: true },
    feeUsd: { type: Number, required: true },
    walletAddress: { type: String, required: true },
    isGroupTrade: { type: Boolean, default: false },
    groupId: { type: Schema.Types.ObjectId, ref: "Group" },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
TradeSchema.index({ telegram_id: 1, tokenAddress: 1 });
TradeSchema.index({ createdAt: -1 });

export default mongoose.model<ITrade>("Trade", TradeSchema);
