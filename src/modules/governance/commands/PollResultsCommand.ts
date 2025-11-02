import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getPollResults } from "@modules/governance/pollService";
import { getAjoByChatId } from "@modules/ajo-groups/ajoService";

export class PollResultsCommand extends BaseCommand {
  name = "poll_results";
  description = "View poll results";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/poll_results <poll_id>`\n\n" +
            "**Example:** `/poll_results 507f1f77bcf86cd799439012`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const pollId = args[0];

      // Get group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get poll results
      const results = await getPollResults(ajoGroup._id.toString(), pollId);

      const resultsMessage = `
📊 **Poll Results**

**Poll ID:** \`${results.poll.id}\`
**Type:** ${results.poll.type.toUpperCase()}
**Status:** ${results.poll.status === "open" ? "🟢 Open" : results.poll.status === "executed" ? "✅ Executed" : "❌ Cancelled"}

**Votes:**
✅ Yes: ${results.results.yesVotes} (${results.results.yesPercentage.toFixed(1)}%)
❌ No: ${results.results.noVotes} (${results.results.noPercentage.toFixed(1)}%)
📊 Total: ${results.results.totalVotes}

**Consensus Required:** ${results.results.consensusThreshold}%
**Current Consensus:** ${results.results.yesPercentage.toFixed(1)}%

${results.poll.type === "trade" ? `**Trade Details:**
• Token: ${results.poll.token_address}
• Amount: ${results.poll.amount} SOL
` : ""}
**Expires:** ${new Date(results.poll.expires_at).toLocaleString()}
      `;

      await ctx.reply(resultsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Poll results error:", error);
      await ctx.reply("❌ Failed to get poll results. Please check the poll ID.");
    }
  }
}



