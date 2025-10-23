import { Connection, PublicKey } from "@solana/web3.js";
import { Context, Markup } from "telegraf";
import { config } from "../config/config";

export async function handleDetectToken(ctx: Context, contractAddress: string) {
  console.log("Detecting token for address:", contractAddress);
  const userId = ctx.from?.id;

  try {
    // ✅ Validate token address on-chain
    const connection = new Connection(config.solMainnet);
    const mintPubkey = new PublicKey(contractAddress);

    const tokenInfo = await connection.getParsedAccountInfo(mintPubkey);
    if (!tokenInfo.value) {
      await ctx.reply("❌ Invalid token address. Please enter a valid Solana token contract.");
      return;
    }

    const owner = (tokenInfo.value as any).owner?.toString();
    if (owner !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
      await ctx.reply("❌ This address is not a token mint account.");
      return;
    }

    // ✅ Fetch token data from Jupiter Lite API
    const jupUrl = `https://lite-api.jup.ag/ultra/v1/search?query=${contractAddress}`;
    const response = await fetch(jupUrl);
    if (!response.ok) {
      await ctx.reply("⚠️ Failed to fetch token data from Jupiter.");
      return;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      await ctx.reply("⚠️ No token data found on Jupiter for this address.");
      return;
    }

    // Extract token info from Jupiter response
    const token = data[0];
    const {
      name,
      symbol,
      icon,
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
<b>${name || "Unknown Token"} (${symbol || "?"})</b>
${icon ? `<a href="${icon}">🖼️</a>` : ""}

<b>Contract:</b> <code>${contractAddress}</code>
<b>Verified:</b> ${token.isVerified ? "✅ Yes" : "❌ No"}
<b>Holders:</b> ${holderCount?.toLocaleString() ?? "N/A"}


<b>Key Metrics</b>

💵 <b>Price:</b> ${usdPrice?.toFixed(6) ?? "N/A"}
📈 <b>24h Change:</b> ${priceChangeString}%
💧 <b>Liquidity:</b> $${liquidity ? liquidity.toLocaleString() : "N/A"}
🏦 <b>Market Cap:</b> ${mcap ? mcap.toLocaleString() : "N/A"}
💰 <b>FDV:</b> ${fdv ? fdv.toLocaleString() : "N/A"}
🧮 <b>Circulating Supply:</b> ${circSupply?.toLocaleString() ?? "N/A"}

Mint Authority Disabled: ${audit?.mintAuthorityDisabled ? "✅" : "❌"}
Freeze Authority Disabled: ${audit?.freezeAuthorityDisabled ? "✅" : "❌"}
24h Traders: ${numTraders?.toLocaleString() ?? "N/A"}



    `;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("💰 Buy", `buy:${contractAddress}`),
        Markup.button.url("📊 Chart", `https://dexscreener.com/solana/${contractAddress}`),
      ],
    ]);

    await ctx.replyWithHTML(metricsMessage, keyboard);
  } catch (error: any) {
    console.error("Error validating contract:", error?.message || error);
    await ctx.reply("❌ Invalid or unrecognized contract address.");
  }
}
