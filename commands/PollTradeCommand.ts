import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { createPoll } from "../services/pollService";
import { validatePollCreation } from "../validations/ajoValidation";
import { getAjoByChatId, isUserTrader } from "../services/ajoService";
import getUser from "../services/getUserInfo";

export class PollTradeCommand extends BaseCommand {
  name = "poll_trade";
  description = "Create a trade poll (traders only)";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 2) {
        await ctx.reply(
          "❌ Usage: `/poll_trade <token> <amount>`\n\n" +
            "**Example:** `/poll_trade BONK 1000`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get user
      const user = await getUser(userId, username);
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register.");
        return;
      }

      // Get ajo group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No Ajo group found in this chat.\n\n" +
            "Use `/create_group` to create a new group first.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is trader
      const isTrader = await isUserTrader(
        ajoGroup._id.toString(),
        userId
      );
      if (!isTrader) {
        await ctx.reply(
          "❌ Only traders can create polls.\n\n" +
            "Contact the group admin to change your role.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const tokenAddress = args[0];
      const amount = parseFloat(args[1]);

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Amount must be a positive number");
        return;
      }

      if (!tokenAddress || tokenAddress.length < 3) {
        await ctx.reply("❌ Please provide a valid token address");
        return;
      }

      // Create the poll
      const poll = await createPoll({
        group_id: ajoGroup._id.toString(),
        creator_id: userId,
        type: "trade",
        title: `${tokenAddress} Trade`,
        token_address: tokenAddress,
        token_symbol: tokenAddress,
        amount: amount,
      });

      const pollMessage = `
🗳️ **New Trade Poll Created!**

**Token:** ${tokenAddress}
**Amount:** ${amount} SOL
**Poll ID:** \`${poll.poll.id}\`
**Consensus Required:** ${ajoGroup.consensus_threshold}%
**Expires:** ${new Date(poll.poll.expires_at).toLocaleString()}

💡 Members can vote using:
\`/vote ${poll.poll.id} yes\` or \`/vote ${poll.poll.id} no\`
      `;

      await ctx.reply(pollMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create trade poll error:", error);
      await ctx.reply("❌ Failed to create trade poll. Please try again.");
    }
  }
}



