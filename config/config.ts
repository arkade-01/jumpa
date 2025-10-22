import dotenv from "dotenv";

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN,
  dbUrl: process.env.DB_URL,
  rpcUrl: process.env.RPC_URL || "",
  evmRpcUrl: process.env.EVM_RPC_URL || "",
  paymentWidgetUrl: process.env.PAYMENT_WIDGET_URL || "",
  paymentRateUrl: process.env.PAYMENT_RATE_URL || "",
  yaraApiKey: process.env.YARA_API_KEY || "",
  solDevnet: process.env.SOL_DEVNET || "",
  solMainnet: process.env.SOL_MAINNET || "",

};