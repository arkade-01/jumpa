import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId } from "../services/ajoService";
import { getGroupFinancialSummary } from "../services/balanceService";
import { Markup } from "telegraf";

export class AjoInfoCommand extends BaseCommand {
  name = "ajo_info";
  description = "Show current Ajo group information";

  async execute(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No Ajo group found in this chat.\n\n" +
            "Use `/create_group` to create a new group.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(ajoGroup);
      const activePolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 **Ajo Group: ${ajoGroup.name}**

💰 **Capital:** ${ajoGroup.current_balance} SOL
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
📈 **Status:** ${ajoGroup.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${ajoGroup.trades.length}

**Group ID:** \`${ajoGroup._id}\`
**Created:** ${new Date(ajoGroup.created_at).toLocaleDateString()}
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("👥 View Members", "ajo_members"),
          Markup.button.callback("🗳️ View Polls", "ajo_polls"),
        ],
        [
          Markup.button.callback("💰 My Balance", "ajo_balance"),
          Markup.button.callback("📊 Group Stats", "group_stats"),
        ],
        [Markup.button.callback("🔄 Refresh", "ajo_info")],
      ]);

      await ctx.reply(infoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Ajo info error:", error);
      await ctx.reply("❌ Failed to get ajo info.");
    }
  }
}




