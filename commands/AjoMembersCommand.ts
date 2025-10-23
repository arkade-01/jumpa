import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId, getAjoInfo } from "../services/ajoService";
import { getMemberFinancialSummary } from "../services/balanceService";

export class AjoMembersCommand extends BaseCommand {
  name = "members";
  description = "List all group members. Optionally specify a group ID.";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      let ajoGroup;
      const groupId = args[0];

      if (groupId) {
        ajoGroup = await getAjoInfo(groupId);
        if (!ajoGroup) {
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
        ajoGroup = await getAjoByChatId(chatId);
        if (!ajoGroup) {
          await ctx.reply(
            "❌ No group found in this chat.\n\n" +
              "Use `/create_group` to create a new group, or specify a group ID: `/members <groupId>`.",
            { parse_mode: "Markdown" }
          );
          return;
        }
      }

      let membersMessage = `
👥 **Group Members: ${ajoGroup.name}**

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
   • Contribution: ${financialSummary.contribution}
   • Joined: ${new Date(member.joined_at).toLocaleDateString()}
`;
        }
      });

      await ctx.reply(membersMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("members error:", error);
      await ctx.reply(`❌ Failed to get group info. Verify that the group ID is correct.`);
    }
  }
}
