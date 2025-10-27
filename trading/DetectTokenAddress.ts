import { Connection, PublicKey } from "@solana/web3.js";
import { Context, Markup } from "telegraf";
import { config } from "../config/config";
import { setTradeState } from "../state/tradeState";
import { randomBytes } from "crypto";

export async function generateTokenInfoMessage(contractAddress: string) {
  console.log("Generating token info for address:", contractAddress);

  // ✅ Validate token address on-chain
  const connection = new Connection(config.solMainnet);
  const mintPubkey = new PublicKey(contractAddress);

  const tokenInfo = await connection.getParsedAccountInfo(mintPubkey);
  if (!tokenInfo.value) {
    throw new Error("Invalid token address. Please enter a valid Solana token contract.");
  }

  const owner = (tokenInfo.value as any).owner?.toString();
  if (owner !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
    throw new Error("This address is not a token mint account.");
  }

  // ✅ Fetch token data from Jupiter Lite API
  const jupUrl = `https://lite-api.jup.ag/ultra/v1/search?query=${contractAddress}`;
  const response = await fetch(jupUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch token data from Jupiter.");
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No token data found on Jupiter for this address.");
  }

  // Extract token info from Jupiter response
  const token = data[0];
  const {
    name,
    symbol,
    icon,
    decimals,
    usdPrice,
    fdv,
    mcap,
    liquidity,
    circSupply,
    stats24h,
    holderCount,
    audit,
  } = token;

  // Compute 24h stats safely
  const priceChange = stats24h?.priceChange ?? 0;
  const priceChangeString = priceChange > 0 ? `+${priceChange.toFixed(2)}` : priceChange.toFixed(2);
  const numTraders = stats24h?.numTraders ?? 0;

  // 🧮 Build Telegram message
  const metricsMessage = `
<b>${name || "Unknown_Token"} (${symbol || "?"})</b>
${icon ? `<a href="${icon}">🖼️</a>` : ""}

<b>Contract:</b> <code>${contractAddress}</code>
<b>Verified:</b> ${token.isVerified ? "✅ Yes" : "❌ No"}
<b>Holders:</b> ${holderCount?.toLocaleString() ?? "N/A"}


<b>Key Metrics</b>

💵 <b>Price:</b> ${usdPrice?.toFixed(6) ?? "N/A"}
📈 <b>24h Change:</b> ${priceChangeString}%
💧 <b>Liquidity:</b> ${liquidity ? liquidity.toLocaleString() : "N/A"}
🏦 <b>Market Cap:</b> ${mcap ? mcap.toLocaleString() : "N/A"}
💰 <b>FDV:</b> ${fdv ? fdv.toLocaleString() : "N/A"}
🧮 <b>Circulating Supply:</b> ${circSupply?.toLocaleString() ?? "N/A"}

Mint Authority Disabled: ${audit?.mintAuthorityDisabled ? "✅" : "❌"}
Freeze Authority Disabled: ${audit?.freezeAuthorityDisabled ? "✅" : "❌"}
24h Traders: ${numTraders?.toLocaleString() ?? "N/A"}
  `;

  const tradeId = randomBytes(8).toString("hex");
  setTradeState(tradeId, {
    contractAddress,
    symbol,
    decimals,
  });

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("Buy 0.01 SOL", `buy:${tradeId}:0.01`),
      Markup.button.callback("Buy 0.05 SOL", `buy:${tradeId}:0.05`),
      Markup.button.callback("Buy 0.1 SOL", `buy:${tradeId}:0.1`),
    ],
    [
      Markup.button.callback("Buy 0.5 SOL", `buy:${tradeId}:0.5`),
      Markup.button.callback("Buy 1 SOL", `buy:${tradeId}:1`),
      Markup.button.callback("Buy 2 SOL", `buy:${tradeId}:2`),
    ],
    [Markup.button.callback("Buy X SOL", `buy_custom:${tradeId}`)],
    [
      Markup.button.callback("Sell 10%", `sell:${tradeId}:10`),
      Markup.button.callback("Sell 20%", `sell:${tradeId}:20`),
      Markup.button.callback("Sell 25%", `sell:${tradeId}:25`),
    ],
    [
      Markup.button.callback("Sell 50%", `sell:${tradeId}:50`),
      Markup.button.callback("Sell 75%", `sell:${tradeId}:75`),
      Markup.button.callback("Sell 100%", `sell:${tradeId}:100`),
    ],
    [
      Markup.button.callback("🔄 Refresh", `refresh:${contractAddress}`),
      Markup.button.url("📊 Chart", `https://dexscreener.com/solana/${contractAddress}`),
    ]
  ]);

  return { metricsMessage, keyboard };
}

export async function handleDetectToken(ctx: Context, contractAddress: string) {
  try {
    const { metricsMessage, keyboard } = await generateTokenInfoMessage(contractAddress);
    await ctx.replyWithHTML(metricsMessage, keyboard);
  } catch (error: any) {
    console.error("Error in handleDetectToken:", error?.message || error);
    await ctx.reply(`❌ ${error.message || "An unrecognized error occurred."}`);
  }
}