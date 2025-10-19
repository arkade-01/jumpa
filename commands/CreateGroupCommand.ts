import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { createAjo } from "../services/ajoService";
import {
  validateAjoCreation,
  validateAndSanitizeGroupName,
} from "../validations/ajoValidation";
import getUser from "../services/getUserInfo";

export class CreateGroupCommand extends BaseCommand {
  name = "create_group";
  description = "Create a new Ajo group with custom parameters";

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

      if (args.length < 3) {
        await ctx.reply(
          "❌ Usage: `/create_group <name> <max_members> <entry_capital> [consensus_threshold]`\n\n" +
            "**Examples:**\n" +
            "• `/create_group CryptoCrew 10 100 67`\n" +
            "• `/create_group MoonTraders 25 500`\n" +
            "• `/create_group DeFi Squad 50 1000 75`\n\n" +
            "**Parameters:**\n" +
            "• **name**: Group name (max 100 characters)\n" +
            "• **max_members**: Maximum members (2-100)\n" +
            "• **entry_capital**: Entry capital in SOL (must be > 0)\n" +
            "• **consensus_threshold**: Voting threshold % (50-100, default: 67)",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse arguments
      const name = args[0];
      const maxMembers = parseInt(args[1]);
      const entryCapital = parseInt(args[2]);
      const consensusThreshold = args[3] ? parseInt(args[3]) : 67;

      // Validate and sanitize input
      const nameValidation = validateAndSanitizeGroupName(name);
      if (!nameValidation.isValid) {
        await ctx.reply(`❌ ${nameValidation.errors.join(", ")}`);
        return;
      }

      const validation = validateAjoCreation({
        name: nameValidation.sanitized,
        initial_capital: entryCapital,
        max_members: maxMembers,
        consensus_threshold: consensusThreshold,
      });

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
            `⚠️ **Important:** You'll need SOL to create groups. Use \`/fund_wallet\` for instructions.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (error) {
        await ctx.reply("❌ Failed to create wallet. Please try /start first.");
        return;
      }

      // Send initial message to user
      const processingMessage = await ctx.reply(
        "🔄 **Creating group on blockchain...**\n\n" +
        "⏳ This may take up to 2 minutes. Please wait...",
        { parse_mode: "Markdown" }
      );

      try {
        // Create the ajo group
        const ajoGroup = await createAjo({
          name: nameValidation.sanitized,
          creator_id: userId,
          telegram_chat_id: chatId,
          initial_capital: entryCapital,
          max_members: maxMembers,
          consensus_threshold: consensusThreshold,
        });

        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        const successMessage = `
✅ **Ajo Group Created Successfully!**

🏠 **Name:** ${ajoGroup.name}
👥 **Max Members:** ${ajoGroup.max_members}
💰 **Entry Capital:** ${ajoGroup.initial_capital} SOL
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
📊 **Status:** Active

**Group ID:** \`${ajoGroup._id}\`

**Next Steps:**
1. Share the Group ID with people you want to invite
2. They can join using: \`/ajo join ${ajoGroup._id}\`
3. Start creating polls with: \`/poll trade <token> <amount>\`

**You are now a trader and can create polls!**

**Quick Actions:**
• Use \`/ajo info\` to view group details
• Use \`/ajo members\` to see members
• Use \`/add_members\` to manage members
      `;

        await ctx.reply(successMessage, { parse_mode: "Markdown" });
      } catch (createError) {
        // Delete the processing message
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, processingMessage.message_id);
        } catch (deleteError) {
          console.log("Could not delete processing message:", deleteError);
        }

        console.error("Create group error:", createError);
        const errorMessage =
          createError instanceof Error ? createError.message : "Unknown error";
        await ctx.reply(`❌ Failed to create Ajo group: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Create group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to create Ajo group: ${errorMessage}`);
    }
  }
}

