import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getAjoByChatId, getAjoInfo } from "@modules/ajo-groups/ajoService";
import { getGroupFinancialSummary } from "@modules/wallets/balanceService";

export class AjoInfoCommand extends BaseCommand {
  name = "info";
  description = "Show current group information. Optionally specify a group ID.";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      let group;
      const groupId = args[0];

      if (groupId) {
        group = await getAjoInfo(groupId);
        if (!group) {
          await ctx.reply(
            `❌ No group found with ID: \`${groupId}\``,
            { parse_mode: "Markdown" }
          );
          return;
        }
      } else {
        const chatId = ctx.chat?.id;
        if (!chatId) {
          await ctx.reply("❌ Unable to identify chat.");
          return;
        }
        group = await getAjoByChatId(chatId);
        if (!group) {
          await ctx.reply(
            "❌ No group found in this chat.\n\n" +
              "Use `/create_group` to create a new group, or specify a group ID: `/info <groupId>`.",
            { parse_mode: "Markdown" }
          );
          return;
        }
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(group);
      const activePolls = group.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 **Group: ${group.name}**

💰 **Capital:** ${group.current_balance} SOL
👥 **Members:** ${group.members.length}/${group.max_members}
🗳️ **Consensus:** ${group.consensus_threshold}%
📈 **Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: ${financialSummary.total_contributions}
• Average Contribution: ${financialSummary.average_contribution}
• Largest Contribution: ${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${group.trades.length}

**Group ID:** \`${group._id}\`
**Created:** ${new Date(group.created_at).toLocaleDateString()}
      `;

      await ctx.reply(infoMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(" info error:", error);
      await ctx.reply("❌ Failed to get info.");
    }
  }
}
