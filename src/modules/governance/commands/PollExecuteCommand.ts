import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { executePoll } from "@modules/governance/pollService";
import { validatePollId } from "@modules/ajo-groups/ajoValidation";
import { getAjoByChatId, isUserTrader } from "@modules/ajo-groups/ajoService";

export class PollExecuteCommand extends BaseCommand {
  name = "poll_execute";
  description = "Execute a poll (traders only)";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/poll_execute <poll_id>`\n\n" +
            "**Example:** `/poll_execute 507f1f77bcf86cd799439012`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const pollId = args[0];

      // Validate poll ID
      const validation = validatePollId(pollId);
      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      // Get group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is trader
      const isTrader = await isUserTrader(
        ajoGroup._id.toString(),
        userId
      );
      if (!isTrader) {
        await ctx.reply(
          "❌ Only traders can execute polls.\n\n" +
            "Contact the group admin to change your role.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Execute the poll
      const result = await executePoll(ajoGroup._id.toString(), pollId);

      const executeMessage = `
✅ **Poll Executed Successfully!**

**Poll ID:** \`${pollId}\`
**Type:** ${result.poll.type.toUpperCase()}
**Status:** Executed

${result.poll.type === "trade" ? `**Trade Details:**
• Token: ${result.poll.token_address}
• Amount: ${result.poll.amount} SOL
• Transaction: In Progress...
` : ""}
${result.poll.type === "end_ajo" ? `**Group Ended**
• Final Balance: ${ajoGroup.current_balance} SOL
• Profits will be distributed to members
` : ""}
      `;

      await ctx.reply(executeMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Execute poll error:", error);
      await ctx.reply(
        "❌ Failed to execute poll. Make sure the poll has reached consensus."
      );
    }
  }
}



