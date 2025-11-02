import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { fetchGroupProposals, getAjoByChatId } from "@modules/ajo-groups/ajoService";
import getUser from "@modules/users/getUserInfo";

export class FetchProposalsCommand extends BaseCommand {
  name = "fetch_proposals";
  description = "Fetch all proposals from blockchain";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
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
          "❌ No  group found in this chat. Create one first with /create_group"
        );
        return;
      }

      await ctx.reply("🔄 Fetching proposals from blockchain...");

      // Fetch proposals from chain
      const proposals = await fetchGroupProposals(ajoGroup._id.toString());

      if (proposals.length === 0) {
        await ctx.reply("📋 No proposals found for this group.");
        return;
      }

      let message = `📊 **On-Chain Proposals (${proposals.length})**\n\n`;

      proposals.forEach((proposal: any, index: number) => {
        const status = proposal.executed ? "✅ Executed" : "🔄 Open";
        const action = proposal.buy ? "BUY" : "SELL";
        
        message += `**${index + 1}. ${proposal.proposerName}**\n`;
        message += `   • Action: ${action}\n`;
        message += `   • Amount: ${proposal.amount}\n`;
        message += `   • Votes: ${proposal.voteCount}\n`;
        message += `   • Status: ${status}\n`;
        message += `   • Created: ${proposal.createdAt.toLocaleDateString()}\n`;
        message += `   • Deadline: ${proposal.deadline.toLocaleDateString()}\n`;
        message += `   • Address: \`${proposal.address.substring(0, 8)}...\`\n\n`;
      });

      message += `\nUse \`/polls\` to view and vote on proposals`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Fetch proposals error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to fetch proposals: ${errorMessage}`);
    }
  }
}

