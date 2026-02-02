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
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  alchemyDevnetRpc: process.env.ALCHEMY_DEVNET_RPC || "",
  alchemyMainnetRpc: process.env.ALCHEMY_MAINNET_RPC || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  paystackBearerKey: process.env.PAYSTACK_BEARER_KEY || "",
  switchApiKey: process.env.SWITCH_LIVE_KEY || "",
  switchSandboxKey: process.env.SWITCH_SANDBOX_KEY || "",
  usdcAddress: process.env.USDC_ADDRESS || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdtAddress: process.env.USDT_ADDRESS || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",

};