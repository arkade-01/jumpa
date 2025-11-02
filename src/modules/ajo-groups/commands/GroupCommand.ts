import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getAjoByChatId } from "@modules/ajo-groups/ajoService";
import getUser from "@modules/users/getUserInfo";

export class GroupCommand extends BaseCommand {
  name = "group";
  description = "Manage Telegram group integration for group trading";

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

      // Check if this is a group chat
      if (ctx.chat?.type === "private") {
        await ctx.reply(
          "❌ This command is only available in Telegram groups.\n\n" +
            "**To use group trading in groups:**\n" +
            "1. Add this bot to your Telegram group\n" +
            "2. Use `/start` in the group to initialize\n" +
            "3. Use `/create_group <name> <max_members> <amount> [consensus_threshold]` to create a trading group\n" +
            "4. Start trading with your group members!",
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

      if (args.length === 0) {
        await this.showGroupStatus(ctx);
        return;
      }

      const subcommand = args[0].toLowerCase();

      switch (subcommand) {
        case "status":
          await this.showGroupStatus(ctx);
          break;
        case "setup":
          await this.showGroupSetup(ctx);
          break;
        case "help":
          await this.showGroupHelp(ctx);
          break;
        default:
          await ctx.reply(
            "❌ Unknown subcommand. Use:\n" +
              "• `/group status` - Show group status\n" +
              "• `/group setup` - Show setup instructions\n" +
              "• `/group help` - Show help information"
          );
      }
    } catch (error) {
      console.error("Group command error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to process group command: ${errorMessage}`);
    }
  }

  private async showGroupStatus(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      // Check if this chat has an  group
      const ajoGroup = await getAjoByChatId(chatId);

      if (!ajoGroup) {
        const statusMessage = `
📊 **Group Status**

**Group:** ❌ Not created
**Group Type:** ${ctx.chat?.type === "supergroup" ? "Supergroup" : "Group"}
**Bot Status:** ✅ Active

**Next Steps:**
1. Use \`/create_group <name> <max_members>\` to create a trading group
2. Share the group ID with members
3. Start trading!

**Quick Commands:**
• \`/group setup\` - Setup instructions
• \`/group help\` - Command help
        `;

        await ctx.reply(statusMessage, { parse_mode: "Markdown" });
        return;
      }

      const statusMessage = `
📊 **Group Status**

**Group:** ✅ ${ajoGroup.name}
**Group ID:** \`${ajoGroup._id}\`
**Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
**Status:** ${ajoGroup.status === "active" ? "🟢 Active" : "🔴 Ended"}
**Consensus:** ${ajoGroup.consensus_threshold}%

**Group Type:** ${ctx.chat?.type === "supergroup" ? "Supergroup" : "Group"}
**Bot Status:** ✅ Active

**Quick Actions:**
• \`/info\` - View group details
• \`/members\` - See members
• \`/polls\` - Active polls
• \`/poll trade <token> <amount>\` - Create trade poll
      `;

      await ctx.reply(statusMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Show group status error:", error);
      await ctx.reply("❌ Failed to get group status.");
    }
  }

  private async showGroupSetup(ctx: Context): Promise<void> {
    try {
      const setupMessage = `
⚙️ **Group Setup Instructions**

**Step 1: Bot Permissions**
Make sure the bot has these permissions:
• ✅ Read messages
• ✅ Send messages  
• ✅ Delete messages
• ✅ Pin messages

**Step 2: Create Group**
Use this command to create your group:
\`/create_group <name> <max_members> <amount> [consensus_threshold]\`

**Examples:**
• \`/create_group CryptoCrew 10 0.1 67\`
• \`/create_group MoonTraders 25\`
• \`/create_group DeFi Squad 50 75\`

**Step 3: Invite Members**
1. Share the Group ID with members
2. They can join using: \`/add_member <group_id>\`
3. Or use: \`/join <group_id>\`

**Step 4: Start Trading**
• Use \`/poll trade <token> <amount>\` to create polls
• Members vote with \`/vote <poll_id> <yes/no>\`
• Execute trades when consensus is reached

**Need Help?**
• \`/group help\` - Command reference
• \`/help\` - General help
      `;

      await ctx.reply(setupMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Show group setup error:", error);
      await ctx.reply("❌ Failed to show setup instructions.");
    }
  }

  private async showGroupHelp(ctx: Context): Promise<void> {
    try {
      const helpMessage = `
📋 **Group Commands Reference**

**Group Management:**
• \`/group status\` - Show group status
• \`/group setup\` - Setup instructions
• \`/group help\` - This help message

**Group Commands:**
• \`/create_group <name> <max_members> <amount> [consensus]\` - Create group
• \`/info\` - View group information
• \`members\` - List members
• \`/polls\` - Show active polls
• \`/balance\` - Your balance
• \`/add_member <group_id>\` - Join group

**Polling & Voting:**
• \`/poll trade <token> <amount>\` - Create trade poll
• \`/poll end\` - Create end poll
• \`/vote <poll_id> <yes/no>\` - Vote on polls
• \`/poll results <poll_id>\` - View results
• \`/poll execute <poll_id>\` - Execute poll

**User Commands:**
• \`/start\` - Initialize bot
• \`/wallet\` - View wallet
• \`/profile\` - User profile

**Examples:**
• \`/create_group CryptoCrew 10 0.1 67\`
• \`/poll trade BONK 1000\`
• \`/vote 507f1f77bcf86cd799439012 yes\`

**Roles:**
• **Creator**: Automatically becomes trader
• **Trader**: Can create polls and execute trades
• **Member**: Can vote on polls and contribute funds
      `;

      await ctx.reply(helpMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Show group help error:", error);
      await ctx.reply("❌ Failed to show help.");
    }
  }
}
