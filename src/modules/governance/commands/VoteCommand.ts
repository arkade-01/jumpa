import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getAjoByChatId } from "@modules/ajo-groups/ajoService";
import solanaService from "@blockchain/solana/solanaService";
import getUser from "@modules/users/getUserInfo";

export class VoteCommand extends BaseCommand {
  name = "vote";
  description = "Vote on a trade proposal";

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

      if (args.length < 2) {
        await ctx.reply(
          "❌ Usage: `/vote <proposal_nonce> <yes|no>`\n\n" +
            "**Examples:**\n" +
            "• `/vote 1760465439812 yes`\n" +
            "• `/vote 1760465439812 no`\n\n" +
            "**Parameters:**\n" +
            "• **proposal_nonce**: The proposal nonce number\n" +
            "• **yes|no**: Your vote",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const proposalNonce = parseInt(args[0]);
      const voteInput = args[1].toLowerCase();

      // Validate nonce
      if (isNaN(proposalNonce)) {
        await ctx.reply("❌ Invalid proposal nonce. Please provide a valid number.");
        return;
      }

      // Validate vote
      if (voteInput !== "yes" && voteInput !== "no") {
        await ctx.reply("❌ Vote must be either 'yes' or 'no'");
        return;
      }

      const yesVote = voteInput === "yes";

      // Auto-register user if not exists
      let user;
      try {
        user = await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Failed to get user info. Please try /start first.");
        return;
      }

      // Get group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = ajoGroup.members.some(m => m.user_id === userId);
      if (!isMember) {
        await ctx.reply(
          "❌ You must be a member of this group to vote.\n\n" +
          "Join the group first with `/join`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get group owner
      const User = (await import("@database/models/user")).default;
      const owner = await User.findOne({ telegram_id: ajoGroup.creator_id });
      if (!owner) {
        await ctx.reply("❌ Group owner not found.");
        return;
      }

      // Send processing message
      const processingMessage = await ctx.reply(
        "🗳️ **Recording your vote on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Vote on-chain
        const result = await solanaService.vote({
          telegramId: userId,
          groupName: ajoGroup.name,
          ownerPubkey: owner.solanaWallets[0].address,
          proposalNonce: proposalNonce,
          yesVote: yesVote,
        });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `✅ *Vote Recorded Successfully!*

🗳️ *Your Vote:* ${yesVote ? '✅ YES' : '❌ NO'}
📝 *Proposal Nonce:* ${proposalNonce}
🏠 *Group:* ${ajoGroup.name}

*Transaction:* \`${result.signature}\`

*Next Steps:*
• Check proposal status with /polls
• Votes are counted automatically
• Proposal executes when threshold is reached`;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (voteError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Vote error:", voteError);
        let errorMessage = voteError instanceof Error ? voteError.message : "Unknown error";
        
        // Provide helpful messages for common errors
        if (errorMessage.includes('fetch failed') || errorMessage.includes('failed to get')) {
          errorMessage = "Network connection issue. The RPC endpoint is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes('AlreadyJoined') || errorMessage.includes('6007')) {
          errorMessage = "You have already voted on this proposal.";
        } else if (errorMessage.includes('ProposalExpired')) {
          errorMessage = "This proposal has expired and can no longer accept votes.";
        } else if (errorMessage.includes('ProposalAlreadyExecuted')) {
          errorMessage = "This proposal has already been executed.";
        } else if (errorMessage.includes('NotAdminError') || errorMessage.includes('6008')) {
          errorMessage = "Only traders can vote on proposals.";
        }
        
        await ctx.reply(`❌ Failed to record vote: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Vote error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to record vote: ${errorMessage}`);
    }
  }
}


