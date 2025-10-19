import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId } from "../services/ajoService";

export class AjoPollsCommand extends BaseCommand {
  name = "ajo_polls";
  description = "Show active Ajo group polls";

  async execute(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No Ajo group found in this chat.\n\n" +
            "Use `/create_group` to create a new group.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const activePolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "open"
      );

      if (activePolls.length === 0) {
        await ctx.reply(
          "📊 No active polls in this Ajo group.\n\n" +
            "Traders can create polls using `/poll_trade` or `/poll_end`.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      let pollsMessage = `
🗳️ **Active Polls: ${ajoGroup.name}**

**Total Active Polls:** ${activePolls.length}

`;

      activePolls.forEach((poll: any, index: number) => {
        const yesVotes = poll.votes.filter((v: any) => v.vote === true).length;
        const noVotes = poll.votes.filter((v: any) => v.vote === false).length;
        const totalVotes = poll.votes.length;
        const yesPercentage =
          totalVotes > 0 ? ((yesVotes / totalVotes) * 100).toFixed(1) : "0";

        pollsMessage += `
${index + 1}. **${poll.poll_type.toUpperCase()} Poll**
   • ID: \`${poll._id}\`
   • Status: ${poll.status === "open" ? "🟢 Open" : "🔴 Closed"}
   • Votes: ${yesVotes} Yes / ${noVotes} No (${yesPercentage}% Yes)
   • Required: ${ajoGroup.consensus_threshold}%
   • Expires: ${new Date(poll.expires_at).toLocaleString()}
   ${poll.poll_type === "trade" ? `• Token: ${poll.trade_details?.token_address}\n   • Amount: ${poll.trade_details?.amount}` : ""}
`;
      });

      pollsMessage += `\n💡 Use \`/vote <poll_id> <yes/no>\` to vote on a poll.`;

      await ctx.reply(pollsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Ajo polls error:", error);
      await ctx.reply("❌ Failed to get group polls.");
    }
  }
}




