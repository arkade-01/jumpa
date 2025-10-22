import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    telegram_id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fiatPayoutAmount: {
      type: Number,
      required: true,
    },
    depositAmount: {
      type: Number,
      required: true,
    },
    yaraSolAddress:{
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

//Indexes
withdrawalSchema.index({ telegram_id: 1 });
withdrawalSchema.index({ wallet_address: 1 });
withdrawalSchema.index({ username: 1 });

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

export default Withdrawal;