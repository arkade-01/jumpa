import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import {
  createPoll,
  voteOnPoll,
  getPollResults,
  executePoll,
  cancelPoll,
} from "../services/pollService";
import {
  validatePollCreation,
  validatePollId,
} from "../validations/ajoValidation";
import { getAjoByChatId, isUserTrader } from "../services/ajoService";
import getUser from "../services/getUserInfo";

export class PollCommand extends BaseCommand {
  name = "poll";
  description = "Poll management commands";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    if (args.length === 0) {
      await this.showHelp(ctx);
      return;
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case "trade":
        await this.handleTradePoll(ctx, args.slice(1));
        break;
      case "end":
        await this.handleEndPoll(ctx);
        break;
      case "vote":
        await this.handleVote(ctx, args.slice(1));
        break;
      case "results":
        await this.handleResults(ctx, args.slice(1));
        break;
      case "execute":
        await this.handleExecute(ctx, args.slice(1));
        break;
      case "cancel":
        await this.handleCancel(ctx, args.slice(1));
        break;
      default:
        await this.showHelp(ctx);
    }
  }

  private async showHelp(ctx: Context): Promise<void> {
    const helpMessage = `
🗳️ **Poll Commands**

**Creating Polls (Traders Only):**
• \`/poll trade <token> <amount>\` - Create trade poll
• \`/poll end\` - Create end ajo poll

**Voting:**
• \`/poll vote <poll_id> <yes/no>\` - Vote on poll

**Poll Management:**
• \`/poll results <poll_id>\` - Show poll results
• \`/poll execute <poll_id>\` - Execute poll (when consensus reached)
• \`/poll cancel <poll_id>\` - Cancel poll

**Examples:**
\`/poll trade BONK 1000\`
\`/poll end\`
\`/poll vote 507f1f77bcf86cd799439012 yes\`
\`/poll results 507f1f77bcf86cd799439012\`
    `;

    await ctx.reply(helpMessage, { parse_mode: "Markdown" });
  }

  private async handleTradePoll(ctx: Context, args: string[]): Promise<void> {
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
          "❌ Usage: `/poll trade <token> <amount>`\n\n" +
            "**Example:** `/poll trade BONK 1000`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a trader
      const isTrader = await isUserTrader(ajoGroup._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can create polls.");
        return;
      }

      const tokenSymbol = args[0].toUpperCase();
      const amount = parseFloat(args[1]);

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Amount must be a positive number.");
        return;
      }

      // For now, we'll use a placeholder token address
      // In a real implementation, you'd look up the actual token address
      const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // BONK address as example

      // Validate poll creation
      const validation = validatePollCreation({
        type: "trade",
        title: `Buy ${amount} ${tokenSymbol}`,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        amount: amount,
        expires_hours: 24,
      });

      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.errors.join(", ")}`);
        return;
      }

      // Create the poll
      const { poll } = await createPoll({
        group_id: ajoGroup._id.toString(),
        creator_id: userId,
        type: "trade",
        title: `Buy ${amount} ${tokenSymbol}`,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        amount: amount,
        expires_hours: 24,
      });

      const pollMessage = `
🗳️ **New Trade Poll Created!**

🔄 **Trade:** Buy ${amount} ${tokenSymbol}
💰 **Estimated Cost:** $${amount * 0.001} SOL *(estimated)*
⏰ **Expires:** ${new Date(poll.expires_at).toLocaleString()}

**Poll ID:** \`${poll.id}\`

**Vote using:**
\`/poll vote ${poll.id} yes\` or \`/poll vote ${poll.id} no\`

**View results:**
\`/poll results ${poll.id}\`
      `;

      await ctx.reply(pollMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create trade poll error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create trade poll: ${errorMessage}`);
    }
  }

  private async handleEndPoll(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a trader
      const isTrader = await isUserTrader(ajoGroup._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can create polls.");
        return;
      }

      // Create the end poll
      const { poll } = await createPoll({
        group_id: ajoGroup._id.toString(),
        creator_id: userId,
        type: "end_ajo",
        title: "End Ajo Group and Distribute Profits",
        expires_hours: 48, // Give more time for end polls
      });

      const pollMessage = `
🗳️ **New End Ajo Poll Created!**

🏁 **Action:** End Ajo Group and Distribute Profits
💰 **Current Balance:** ${ajoGroup.current_balance} SOL
⏰ **Expires:** ${new Date(poll.expires_at).toLocaleString()}

**Poll ID:** \`${poll.id}\`

**Vote using:**
\`/poll vote ${poll.id} yes\` or \`/poll vote ${poll.id} no\`

**View results:**
\`/poll results ${poll.id}\`

⚠️ **Warning:** This will end the group and distribute all funds!
      `;

      await ctx.reply(pollMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create end poll error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create end poll: ${errorMessage}`);
    }
  }

  private async handleVote(ctx: Context, args: string[]): Promise<void> {
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
          "❌ Usage: `/poll vote <poll_id> <yes/no>`\n\n" +
            "**Example:** `/poll vote 507f1f77bcf86cd799439012 yes`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      const pollId = args[0];
      const voteString = args[1].toLowerCase();

      // Validate poll ID
      const pollIdValidation = validatePollId(pollId);
      if (!pollIdValidation.isValid) {
        await ctx.reply(`❌ ${pollIdValidation.errors.join(", ")}`);
        return;
      }

      // Parse vote
      let vote: boolean;
      if (voteString === "yes" || voteString === "y" || voteString === "true") {
        vote = true;
      } else if (
        voteString === "no" ||
        voteString === "n" ||
        voteString === "false"
      ) {
        vote = false;
      } else {
        await ctx.reply("❌ Vote must be 'yes' or 'no'.");
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Vote on the poll
      const { poll } = await voteOnPoll({
        group_id: ajoGroup._id.toString(),
        poll_id: pollId,
        user_id: userId,
        vote: vote,
      });

      const voteMessage = `
✅ **Vote Recorded!**

🗳️ **Poll:** ${poll.title}
📊 **Your Vote:** ${vote ? "✅ Yes" : "❌ No"}
🗳️ **Total Votes:** ${poll.votes.length}

**View results:**
\`/poll results ${pollId}\`
      `;

      await ctx.reply(voteMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Vote error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to vote: ${errorMessage}`);
    }
  }

  private async handleResults(ctx: Context, args: string[]): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/poll results <poll_id>`\n\n" +
            "**Example:** `/poll results 507f1f77bcf86cd799439012`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const pollId = args[0];

      // Validate poll ID
      const pollIdValidation = validatePollId(pollId);
      if (!pollIdValidation.isValid) {
        await ctx.reply(`❌ ${pollIdValidation.errors.join(", ")}`);
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Get poll results
      const { poll, results } = await getPollResults(
        ajoGroup._id.toString(),
        pollId
      );

      const resultsMessage = `
📊 **Poll Results**

🗳️ **Poll:** ${poll.title}
📈 **Status:** ${
        poll.status === "open"
          ? "🟢 Open"
          : poll.status === "executed"
          ? "✅ Executed"
          : "❌ Cancelled"
      }
⏰ **Expires:** ${new Date(poll.expires_at).toLocaleString()}

**Voting Results:**
✅ **Yes:** ${results.yesVotes} votes (${results.yesPercentage.toFixed(1)}%)
❌ **No:** ${results.noVotes} votes (${results.noPercentage.toFixed(1)}%)
🗳️ **Total:** ${results.totalVotes} votes

**Consensus:**
🎯 **Threshold:** ${results.consensusThreshold}%
📊 **Yes Power:** ${results.yesVotingPower.toFixed(2)} SOL
📊 **Total Power:** ${results.totalVotingPower.toFixed(2)} SOL
${
  results.consensusReached
    ? "✅ **Consensus Reached!**"
    : "⏳ **Consensus Not Reached**"
}

**Poll ID:** \`${pollId}\`
      `;

      await ctx.reply(resultsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Poll results error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to get poll results: ${errorMessage}`);
    }
  }

  private async handleExecute(ctx: Context, args: string[]): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/poll execute <poll_id>`\n\n" +
            "**Example:** `/poll execute 507f1f77bcf86cd799439012`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const pollId = args[0];

      // Validate poll ID
      const pollIdValidation = validatePollId(pollId);
      if (!pollIdValidation.isValid) {
        await ctx.reply(`❌ ${pollIdValidation.errors.join(", ")}`);
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a trader
      const isTrader = await isUserTrader(ajoGroup._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can execute polls.");
        return;
      }

      // Execute the poll
      const { poll } = await executePoll(ajoGroup._id.toString(), pollId);

      const executeMessage = `
✅ **Poll Executed Successfully!**

🗳️ **Poll:** ${poll.title}
📈 **Status:** Executed
⏰ **Executed At:** ${new Date().toLocaleString()}

${
  poll.type === "trade"
    ? `🔄 **Trade recorded in group history**`
    : `🏁 **Ajo group has been ended**`
}
      `;

      await ctx.reply(executeMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Execute poll error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to execute poll: ${errorMessage}`);
    }
  }

  private async handleCancel(ctx: Context, args: string[]): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/poll cancel <poll_id>`\n\n" +
            "**Example:** `/poll cancel 507f1f77bcf86cd799439012`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const pollId = args[0];

      // Validate poll ID
      const pollIdValidation = validatePollId(pollId);
      if (!pollIdValidation.isValid) {
        await ctx.reply(`❌ ${pollIdValidation.errors.join(", ")}`);
        return;
      }

      // Get ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No Ajo group found in this chat.");
        return;
      }

      // Check if user is a trader
      const isTrader = await isUserTrader(ajoGroup._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can cancel polls.");
        return;
      }

      // Cancel the poll
      const { poll } = await cancelPoll(ajoGroup._id.toString(), pollId);

      const cancelMessage = `
❌ **Poll Cancelled**

🗳️ **Poll:** ${poll.title}
📈 **Status:** Cancelled
⏰ **Cancelled At:** ${new Date().toLocaleString()}
      `;

      await ctx.reply(cancelMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Cancel poll error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to cancel poll: ${errorMessage}`);
    }
  }
}
