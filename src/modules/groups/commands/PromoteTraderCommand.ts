import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getGroupByChatId, promoteToTrader, addTraderToGroup } from "@modules/groups/groupService";
import getUser from "@modules/users/getUserInfo";

export class PromoteTraderCommand extends BaseCommand {
  name = "promote_trader";
  description = "Promote a member to trader (owner only)";

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
          "❌ Usage: `/promote_trader <username>`\n\n" +
          "**Example:** `/promote_trader @john_doe` or `/promote_trader john_doe`\n\n" +
          "**Note:** Only the group owner can promote members to traders.",
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

      // Get group
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is the owner
      if (group.creator_id !== userId) {
        await ctx.reply(
          "❌ Only the group owner can promote members to traders.\n\n" +
          "Contact the group owner to change member roles.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if target user is a member
      const targetMember = group.members.find(
        (member) => member.user_id === targetUserId
      );
      if (!targetMember) {
        await ctx.reply(
          `❌ User ${targetUserId} is not a member of this group.\n\n` +
          "They need to join the group first using `/join`.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if already a trader
      if (targetMember.role === "trader") {
        await ctx.reply("❌ This user is already a trader.");
        return;
      }

      // Send processing message
      const processingMessage = await ctx.reply(
        "🔄 **Promoting member to trader on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Add trader on-chain (this also updates the database)
        let onChainResult;
        if (group.onchain_group_address) {
          onChainResult = await addTraderToGroup(
            group._id.toString(),
            targetUserId,
            userId
          );
        } else {
          // If no on-chain address, just update database
          await promoteToTrader(group._id.toString(), targetUserId);
        }

        const wasAlreadyOnChain = onChainResult?.signature === 'already_exists';

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `✅ *Member Promoted to Trader!*

👤 *User:* @${targetUsername}
🏠 *Group:* ${group.name}
🛠️ *New Role:* Trader
${wasAlreadyOnChain ? '\n📝 Note: User was already a trader on-chain, database has been synced.\n' : ''}
*Trader Permissions:*
• Create trade proposals
• Execute approved polls
• Vote on all decisions

*Next Steps:*
• User can now use /propose_trade to create proposals
• User can execute polls with /poll_execute`;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });

        // Notify the promoted user if possible
        try {
          await ctx.telegram.sendMessage(
            targetUserId,
            `🎉 *Congratulations!*\n\n` +
            `You've been promoted to *Trader* in the group "${group.name}"!\n\n` +
            `You can now:\n` +
            `• Create trade proposals with /propose_trade\n` +
            `• Execute approved polls with /poll_execute\n` +
            `• Vote on all decisions`,
            { parse_mode: "Markdown" }
          );
        } catch (notifyError) {
          console.log("Could not notify promoted user:", notifyError);
        }
      } catch (promoteError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Promote trader error:", promoteError);
        let errorMessage = promoteError instanceof Error ? promoteError.message : "Unknown error";

        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get info about account')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        }

        await ctx.reply(`❌ Failed to promote trader: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Promote trader error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to promote trader: ${errorMessage}`);
    }
  }
}

