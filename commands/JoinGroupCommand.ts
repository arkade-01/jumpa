import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { joinAjo } from "../services/ajoService";
import getUser from "../services/getUserInfo";

export class JoinGroupCommand extends BaseCommand {
  name = "join_group";
  description = "Join an existing group with a group ID";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      if (args.length !== 1) {
        await ctx.reply(
          "❌ Usage: `/join_group <groupId>`\n\n" +
            "**Example:**\n" +
            "• `/join_group 60d5f1b3e6b3f3b3f3b3f3b3`\n\n" +
            "**Parameter:**\n" +
            "• **groupId**: The ID of the group you want to join",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const groupId = args[0];

      // Auto-register user if not exists (creates wallet automatically)
      let user;
      try {
        user = await getUser(userId, username);
        
        // If this is a new user, send welcome message
        if (user && !user.last_seen) {
          await ctx.reply(
            `👋 Welcome! I've created a wallet for you.\n\n` +
            `🔑 **Wallet:** 
${user.wallet_address}

` +
            `⚠️ **Important:** You'll need SOL to join groups. Use 
/fund_wallet for instructions.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (error) {
        await ctx.reply("❌ Failed to create wallet. Please try /start first.");
        return;
      }

      const processingMessage = await ctx.reply(
        "🔄 **Joining group...**\n\n" +
        "⏳ This may take a moment. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        const group = await joinAjo({ group_id: groupId, user_id: userId });

        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `
✅ **Successfully Joined Group!**

🏠 **Name:** ${group.name}
👥 **Members:** ${group.members.length}/${group.max_members}
💰 **Entry Capital:** ${group.initial_capital} SOL

**You are now a member of this group!**

**Quick Actions:**
• Use 
/info ${group._id} to view group details
• Use 
/members ${group._id} to see members
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (joinError) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Join group error:", joinError);
        const errorMessage =
          joinError instanceof Error ? joinError.message : "Unknown error";
        await ctx.reply(`❌ Failed to join group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Join group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join group: ${errorMessage}`);
    }
  }
}
