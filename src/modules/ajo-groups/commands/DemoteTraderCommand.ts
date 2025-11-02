import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getAjoByChatId, removeTraderOnChain } from "@modules/ajo-groups/ajoService";
import getUser from "@modules/users/getUserInfo";

export class DemoteTraderCommand extends BaseCommand {
  name = "demote_trader";
  description = "Demote a trader to regular member (owner only)";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/demote_trader <username>`\n\n" +
            "**Example:** `/demote_trader @john_doe` or `/demote_trader john_doe`\n\n" +
            "**Note:** Only the group owner can demote traders.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse username (remove @ if present)
      let targetUsername = args[0];
      if (targetUsername.startsWith('@')) {
        targetUsername = targetUsername.substring(1);
      }

      // Find user by username
      const User = (await import("@database/models/user")).default;
      const targetUser = await User.findOne({ username: targetUsername });
      if (!targetUser) {
        await ctx.reply(
          `❌ User @${targetUsername} not found.\n\n` +
            "Make sure they have registered with the bot using /start.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const targetUserId = targetUser.telegram_id;

      // Get  group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is the owner
      if (ajoGroup.creator_id !== userId) {
        await ctx.reply(
          "❌ Only the group owner can demote traders.\n\n" +
            "Contact the group owner to change member roles.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if target user is a member
      const targetMember = ajoGroup.members.find(
        (member) => member.user_id === targetUserId
      );
      if (!targetMember) {
        await ctx.reply(
          `❌ User @${targetUsername} is not a member of this group.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is a trader
      if (targetMember.role !== "trader") {
        await ctx.reply("❌ This user is not a trader.");
        return;
      }

      // Check if trying to demote themselves
      if (targetUserId === userId) {
        await ctx.reply("❌ You cannot demote yourself.");
        return;
      }

      // Send processing message
      const processingMessage = await ctx.reply(
        "🔄 **Demoting trader on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Remove trader on-chain
        if (ajoGroup.onchain_group_address) {
          await removeTraderOnChain(
            ajoGroup._id.toString(),
            targetUserId,
            userId
          );
        }

        // Update database
        targetMember.role = "member";
        await ajoGroup.save();

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `✅ *Trader Demoted to Member!*

👤 *User:* @${targetUsername}
🏠 *Group:* ${ajoGroup.name}
👥 *New Role:* Member

*Member Permissions:*
• Vote on proposals
• Contribute to group funds
• View group information

*Note:* User can no longer create or execute proposals.`;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });

        // Notify the demoted user
        try {
          await ctx.telegram.sendMessage(
            targetUserId,
            `📢 *Role Update*\n\n` +
            `You've been changed to *Member* role in the group "${ajoGroup.name}".\n\n` +
            `You can still:\n` +
            `• Vote on proposals\n` +
            `• Contribute funds\n` +
            `• View group info`,
            { parse_mode: "Markdown" }
          );
        } catch (notifyError) {
          console.log("Could not notify demoted user:", notifyError);
        }
      } catch (demoteError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Demote trader error:", demoteError);
        let errorMessage = demoteError instanceof Error ? demoteError.message : "Unknown error";
        
        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes('NotATrader') || errorMessage.includes('6010')) {
          errorMessage = "This user is not a trader on-chain.";
        }
        
        await ctx.reply(`❌ Failed to demote trader: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Demote trader error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to demote trader: ${errorMessage}`);
    }
  }
}


