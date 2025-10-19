import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId, isUserTrader, joinAjo } from "../services/ajoService";
import { validateGroupId } from "../validations/ajoValidation";
import getUser from "../services/getUserInfo";

export class AddMemberCommand extends BaseCommand {
  name = "add_member";
  description = "Add a member to an Ajo group";

  async execute(ctx: Context): Promise<void> {
    try {
      const args =
        ctx.message && "text" in ctx.message
          ? ctx.message.text.split(" ").slice(1)
          : [];

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/add_member <group_id>`\n\n" +
            "**Example:** `/add_member 507f1f77bcf86cd799439011`\n\n" +
            "**Note:** This command is for joining groups. Use the Group ID provided by the group creator.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const groupId = args[0];

      // Validate group ID
      const validation = validateGroupId(groupId);
      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      // Auto-register user if not exists (creates wallet automatically)
      let user;
      try {
        user = await getUser(userId, username);
        
        // If this is a new user, send welcome message
        if (user && !user.last_seen) {
          await ctx.reply(
            `👋 Welcome! I've created a wallet for you.\n\n` +
            `🔑 **Wallet:** \`${user.wallet_address}\`\n\n` +
            `⚠️ **Important:** You'll need SOL to join groups. Use \`/fund_wallet\` for instructions.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (error) {
        await ctx.reply("❌ Failed to create wallet. Please try /start first.");
        return;
      }

      // Send initial message to user
      const processingMessage = await ctx.reply(
        "🔄 **Joining group on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Join the ajo group
        const ajoGroup = await joinAjo({
          group_id: groupId,
          user_id: userId,
          contribution: 0, // Will be updated when they contribute
        });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

      const successMessage = `
✅ **Successfully Joined Ajo Group!**

🏠 **Group:** ${ajoGroup.name}
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%

**Next Steps:**
1. Contribute funds to the group
2. Vote on trading decisions
3. Share in the profits!

**Useful Commands:**
• \`/ajo info\` - View group details
• \`/ajo polls\` - See active polls
• \`/ajo balance\` - Check your share
• \`/ajo members\` - See all members
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (joinError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Add member error:", joinError);
        let errorMessage = joinError instanceof Error ? joinError.message : "Unknown error";
        
        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get info about account')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        }
        
        await ctx.reply(`❌ Failed to join Ajo group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Add member error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to join Ajo group: ${errorMessage}`);
    }
  }
}
