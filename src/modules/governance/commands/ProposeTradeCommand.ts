import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { createTradeProposal } from "@modules/ajo-groups/ajoService";
import { getAjoByChatId } from "@modules/ajo-groups/ajoService";
import getUser from "@modules/users/getUserInfo";

export class ProposeTradeCommand extends BaseCommand {
  name = "propose_trade";
  description = "Create a trade proposal (traders only)";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 4) {
        await ctx.reply(
          "❌ Usage: `/propose_trade <name> <token_mint> <amount> <buy|sell>`\n\n" +
            "**Examples:**\n" +
            "• `/propose_trade \"Buy SOL\" So11111111111111111111111111111111111111112 100 buy`\n" +
            "• `/propose_trade BuyUSDC EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 500 buy`\n" +
            "• `/propose_trade SellBonk DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 1000 sell`\n\n" +
            "**Parameters:**\n" +
            "• **name**: Trade name/description\n" +
            "• **token_mint**: Token mint address\n" +
            "• **amount**: Token amount\n" +
            "• **buy|sell**: Trade direction",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get the group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat. Create one first with /create_group"
        );
        return;
      }

      // Parse arguments - handle quoted names
      let name = "";
      let remainingArgs = [];
      
      if (args[0].startsWith('"')) {
        // Find the closing quote
        let nameEnd = 0;
        let fullName = args[0];
        
        if (!args[0].endsWith('"')) {
          // Name spans multiple args
          for (let i = 1; i < args.length; i++) {
            fullName += " " + args[i];
            if (args[i].endsWith('"')) {
              nameEnd = i;
              break;
            }
          }
        } else {
          nameEnd = 0;
        }
        
        name = fullName.replace(/"/g, "");
        remainingArgs = args.slice(nameEnd + 1);
      } else {
        name = args[0];
        remainingArgs = args.slice(1);
      }

      if (remainingArgs.length < 3) {
        await ctx.reply(
          "❌ Missing parameters. Usage: `/propose_trade <name> <token_mint> <amount> <buy|sell>`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const tokenMint = remainingArgs[0];
      const amount = parseFloat(remainingArgs[1]);
      const action = remainingArgs[2].toLowerCase();
      
      // Use System Program as default token account (contract doesn't validate it anyway)
      const tokenAccount = "11111111111111111111111111111111";

      // Validate token mint address
      try {
        const { PublicKey } = await import("@solana/web3.js");
        new PublicKey(tokenMint);
      } catch (error) {
        await ctx.reply(
          `❌ Invalid token mint address: ${tokenMint}\n\n` +
          "Please provide a valid Solana address (base58 format).",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Amount must be a positive number");
        return;
      }

      // Validate action
      if (action !== "buy" && action !== "sell") {
        await ctx.reply("❌ Action must be either 'buy' or 'sell'");
        return;
      }

      const buy = action === "buy";

      // Send processing message
      const processingMessage = await ctx.reply(
        "🔄 **Creating trade proposal on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Create trade proposal
        const result = await createTradeProposal({
        group_id: ajoGroup._id.toString(),
        proposer_telegram_id: userId,
        name: name,
        token_mint: tokenMint,
        token_account: tokenAccount,
        amount: amount,
        buy: buy,
      });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `
✅ **Trade Proposal Created Successfully!**

📝 **Proposal:** ${name}
🪙 **Token Mint:** \`${tokenMint.substring(0, 8)}...${tokenMint.substring(tokenMint.length - 8)}\`
💰 **Amount:** ${amount}
📊 **Action:** ${buy ? "BUY" : "SELL"}

**On-Chain Address:** \`${result.proposalPDA}\`
**Transaction:** \`${result.signature}\`

**Next Steps:**
• Members will be notified to vote
• Use \`/polls\` to view all active proposals
• Voting threshold: ${ajoGroup.consensus_threshold}%

⏳ **This proposal will expire in 48 hours**
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });

        // Notify the group
        await ctx.reply(
          `🔔 **New Trade Proposal!**\n\n` +
            `@${username} has proposed: ${name}\n` +
            `Amount: ${amount} ${buy ? "(BUY)" : "(SELL)"}\n\n` +
            `View details with: \`/polls\``,
          { parse_mode: "Markdown" }
        );
      } catch (proposeError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Propose trade error:", proposeError);
        let errorMessage = proposeError instanceof Error ? proposeError.message : "Unknown error";
        
        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        }
        
        await ctx.reply(`❌ Failed to create trade proposal: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Propose trade error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create trade proposal: ${errorMessage}`);
    }
  }
}


