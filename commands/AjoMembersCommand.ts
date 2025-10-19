import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId } from "../services/ajoService";
import { getMemberFinancialSummary } from "../services/balanceService";

export class AjoMembersCommand extends BaseCommand {
  name = "ajo_members";
  description = "List all Ajo group members";

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

      let membersMessage = `
👥 **Ajo Group Members: ${ajoGroup.name}**

**Total Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}

`;

      ajoGroup.members.forEach((member: any, index: number) => {
        const financialSummary = getMemberFinancialSummary(
          ajoGroup,
          member.user_id
        );
        const roleEmoji =
          member.role === "trader" ? "⭐" : member.role === "admin" ? "👑" : "👤";

        if (financialSummary) {
          membersMessage += `
${index + 1}. ${roleEmoji} **Member ${index + 1}**
   • Telegram ID: ${member.user_id}
   • Role: ${member.role}
   • Share: ${financialSummary.share_percentage.toFixed(2)}%
   • Contribution: $${financialSummary.contribution}
   • Joined: ${new Date(member.joined_at).toLocaleDateString()}
`;
        }
      });

      await ctx.reply(membersMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Ajo members error:", error);
      await ctx.reply("❌ Failed to get group members.");
    }
  }
}

