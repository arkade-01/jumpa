import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    telegram_id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    solanaWallets: [
      {
        address: {
          type: String,
          required: true,
          index: true,
        },
        encryptedPrivateKey: {
          type: String,
          required: true,
        },
        balance: {
          type: Number,
          default: 0,
        },
        last_updated_balance: {
          type: Date,
          default: Date.now,
        },
        usdcBalance: {
          type: Number,
          default: 0,
        },
        usdtBalance: {
          type: Number,
          default: 0,
        },
        last_updated_token_balance: {
          type: Date,
          default: () => new Date(0), // Set to epoch start to force initial fetch
        },
      },
    ],
    evmWallets: [
      {
        address: {
          type: String,
          required: true,
          index: true,
        },
        encryptedPrivateKey: {
          type: String,
          required: true,
        },
        balance: {
          type: Number,
          default: 0,
        },
        celo: {
          eth: { type: Number, default: 0 },
          usdc: { type: Number, default: 0 },
          usdt: { type: Number, default: 0 },
        },
        base: {
          eth: { type: Number, default: 0 },
          usdc: { type: Number, default: 0 },
          usdt: { type: Number, default: 0 },
        },
        last_updated_balance: {
          type: Date,
          default: Date.now,
        },
        last_updated_evm_balance: {
          type: Date,
          default: () => new Date(0), // Set to epoch start to force initial fetch
        },
      },
    ],
    amadeusWallets: [
      {
        publicKey: {
          type: String,
          index: true,
        },
        encryptedPrivateKey: {
          type: String,
        },
        balance: {
          type: Number,
          default: 0,
        },
        last_updated_balance: {
          type: Date,
          default: Date.now,
        },
      }],
    referrals: {
      referralCode: {
        type: String,
        unique: true,
        sparse: true, // allows null values while maintaining uniqueness
        index: true,
      },
      referralPoints: {
        type: Number,
        default: 0,
      },
      referredBy: {
        type: Number, // telegram_id of the user who referred
        default: null,
        index: true,
      },
      totalReferrals: {
        type: Number,
        default: 0,
      },
      myReferrals: [
        {
          type: Number, // array of telegram_ids of referred users
        },
      ],
    },
    bank_details: {
      account_number: {
        type: String,
        default: "",
      },
      account_name: {
        type: String,
        default: "",
      },
      bank_name: {
        type: String,
        default: "",
      },
      bank_code: { //yara bank code
        type: String,
        default: "",
      },
      withdrawalPin: {
        type: Number,
        default: 0,
      },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    slippage_preference: {
      type: Number,
      default: 100, // Default 1%
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;