import mongoose, { Schema, Document } from "mongoose";

export interface IDeposit extends Document {
  telegram_id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  asset: string;
  destination_amount: number;
  destination_currency: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  timestamp: Date;
}

const DepositSchema: Schema = new Schema({
  telegram_id: { type: Number, required: true, index: true },
  reference: { type: String, required: true, unique: true },
  status: { type: String, default: 'AWAITING_DEPOSIT' },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  asset: { type: String, required: true },
  destination_amount: { type: Number, required: true },
  destination_currency: { type: String, required: true },
  bank_name: { type: String, required: true },
  account_number: { type: String, required: true },
  account_name: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IDeposit>("Deposit", DepositSchema);
