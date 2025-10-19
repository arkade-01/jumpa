import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { getAjoByChatId } from "../services/ajoService";
import solanaService from "../services/solanaService";
import getUser from "../services/getUserInfo";

export class LeaveGroupCommand extends BaseCommand {
  name = "leave_group";
  description = "Leave an Ajo group";

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
      let user;
      try {
        user = await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get ajo group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a member
      const memberIndex = ajoGroup.members.findIndex(m => m.user_id === userId);
      if (memberIndex === -1) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Check if user is the owner
      if (ajoGroup.creator_id === userId) {
        await ctx.reply(
          "❌ Group owners cannot leave their own group.\n\n" +
          "You can end the group using `/poll_end` instead.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get group owner
      const User = (await import("../models/user")).default;
      const owner = await User.findOne({ telegram_id: ajoGroup.creator_id });
      if (!owner) {
        await ctx.reply("❌ Group owner not found.");
        return;
      }

      // Send processing message
      const processingMessage = await ctx.reply(
        "🚪 **Leaving group on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Exit group on-chain
        if (ajoGroup.onchain_group_address) {
          await solanaService.exitGroup({
            telegramId: userId,
            groupName: ajoGroup.name,
            ownerPubkey: owner.wallet_address,
          });
        }

        // Remove from database
        ajoGroup.members.splice(memberIndex, 1);
        await ajoGroup.save();

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `✅ *You've Left the Group*

🏠 *Group:* ${ajoGroup.name}
👥 *Remaining Members:* ${ajoGroup.members.length}/${ajoGroup.max_members}

Your member profile has been closed and any remaining balance will be returned to you.

*You can rejoin anytime with:* /ajo join`;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (exitError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Leave group error:", exitError);
        let errorMessage = exitError instanceof Error ? exitError.message : "Unknown error";
        
        // Provide helpful message for RPC errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes('NotAMemberError') || errorMessage.includes('6009')) {
          errorMessage = "You are not a member of this group on-chain.";
        }
        
        await ctx.reply(`❌ Failed to leave group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Leave group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to leave group: ${errorMessage}`);
    }
  }
}


