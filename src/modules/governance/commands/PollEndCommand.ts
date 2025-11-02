import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { createPoll } from "@modules/governance/pollService";
import { validatePollCreation } from "@modules/ajo-groups/ajoValidation";
import { getAjoByChatId, isUserTrader } from "@modules/ajo-groups/ajoService";
import getUser from "@modules/users/getUserInfo";

export class PollEndCommand extends BaseCommand {
  name = "poll_end";
  description = "Create an end group poll (traders only)";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get user
      const user = await getUser(userId, username);
      if (!user) {
        await ctx.reply("❌ User not found. Please use /start to register.");
        return;
      }

      // Get group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
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

      // Create the poll
      const poll = await createPoll({
        group_id: ajoGroup._id.toString(),
        creator_id: userId,
        type: "end_ajo",
        title: "End Group",
      });

      const pollMessage = `
🗳️ **New End Poll Created!**

**Poll Type:** End Group
**Poll ID:** \`${poll.poll.id}\`
**Consensus Required:** ${ajoGroup.consensus_threshold}%
**Expires:** ${new Date(poll.poll.expires_at).toLocaleString()}

⚠️ **Warning:** If this poll passes, the group will be ended and profits will be distributed.

💡 Members can vote using:
\`/vote ${poll.poll.id} yes\` or \`/vote ${poll.poll.id} no\`
      `;

      await ctx.reply(pollMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create end poll error:", error);
      await ctx.reply("❌ Failed to create end poll. Please try again.");
    }
  }
}



