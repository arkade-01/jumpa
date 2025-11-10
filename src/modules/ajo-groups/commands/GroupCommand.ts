import { Context } from "telegraf";
import { Markup } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import {
  getGroupByChatId,
  getUserGroups,
  isUserMember,
} from "@modules/ajo-groups/groupService";
import getUser from "@modules/users/getUserInfo";
import {
  getGroupFinancialSummary,
  getMemberFinancialSummary,
} from "@modules/wallets/balanceService";

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
          "3. Use `/create_group <name> <max_members> <type>` to create a trading group\n" +
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
        await this.showGroupManagement(ctx);
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
        case "info":
          await this.handleInfo(ctx);
          break;
        case "members":
          await this.handleMembers(ctx);
          break;
        case "balance":
          await this.handleBalance(ctx);
          break;
        case "my_groups":
          await this.handleMyGroups(ctx);
          break;
        default:
          await ctx.reply(
            "❌ Unknown subcommand. Use:\n" +
            "• `/group` - Group management panel\n" +
            "• `/group status` - Show group status\n" +
            "• `/group setup` - Setup instructions\n" +
            "• `/group help` - Help information\n" +
            "• `/group info` - Group details\n" +
            "• `/group members` - List members\n" +
            "• `/group balance` - Your balance\n" +
            "• `/group my_groups` - Your groups"
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

      // Check if this chat has a group
      const group = await getGroupByChatId(chatId);

      if (!group) {
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
• \`/group\` - Management panel
• \`/group setup\` - Setup instructions
• \`/group help\` - Command help
        `;

        await ctx.reply(statusMessage, { parse_mode: "Markdown" });
        return;
      }

      const statusMessage = `
📊 **Group Status**

**Group:** ✅ ${group.name}
**Group ID:** \`${group._id}\`
**Members:** ${group.members.length}/${group.max_members}
**Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}

**Group Type:** ${ctx.chat?.type === "supergroup" ? "Supergroup" : "Group"}
**Bot Status:** ✅ Active

**Quick Actions:**
• \`/info\` - View group details
• \`/members\` - See members
• \`/polls\` - Active polls
• \`/poll trade <token> <amount>\` - Create trade poll
• \`/group\` - Group management panel
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
\`/create_group <name> <max_members> <type>\`

**Examples:**
• \`/create_group CryptoCrew 10 0.1 public\`
• \`/create_group MoonTraders 25 private\`
• \`/create_group DeFi Squad 50 private\`

**Step 3: Invite Members**
1. Share the Group ID with friends
2. They can join using: \`/join <group_id>\`

**Step 4: Start Trading**

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
• \`/group\` - Group management panel
• \`/group status\` - Show group status
• \`/group setup\` - Setup instructions
• \`/group help\` - This help message

**Group Commands:**
• \`/create_group <name> <max_members> <type>\` - Create group
• \`/info\` - View group information
• \`members\` - List members
• \`/polls\` - Show active polls
• \`/balance\` - Your balance
• \`/join <group_id>\` - Join group

**User Commands:**
• \`/start\` - Initialize bot
• \`/wallet\` - View wallet
• \`/profile\` - User profile

**Examples:**
• \`/create_group CryptoCrew 10 0.1 public\`
• \`/join 507f1f77bcf86cd799439012 yes\`

**Roles:**
• **Owner**: Automatically becomes trader
• **Trader**: Can create polls and execute trades
• **Member**: Can vote on polls and contribute funds
      `;

      await ctx.reply(helpMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Show group help error:", error);
      await ctx.reply("❌ Failed to show help.");
    }
  }

  private async showGroupManagement(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      // Check if this chat has a group
      const group = await getGroupByChatId(chatId);

      if (!group) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
          "Create a group first using:\n" +
          "`/create_group <name> <max_members> <type>`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const managementMessage = `
🎛️ **${group.name}**

**Group ID:** \`${group._id}\`
**Type:** ${group.is_private ? "🔒 Private (requires approval)" : "🌐 Public (auto-approved)"}
**Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}
**Balance:** ${group.current_balance || 0} SOL
      `;

      // Create inline keyboard with simplified management options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("💰 Deposit Funds", "group_deposit"),
          Markup.button.callback("🚪 Exit Group", "group_exit"),
        ],
        [
          Markup.button.callback("⚙️ Group Settings", "group_settings"),
          Markup.button.callback("➕ More Actions", "group_more_actions"),
        ],
        [
          Markup.button.callback("🔄 Refresh", "group_manage_refresh"),
        ]
      ]);

      await ctx.reply(managementMessage, {
        parse_mode: "Markdown",
        ...keyboard
      });
    } catch (error) {
      console.error("Show group management error:", error);
      await ctx.reply("❌ Failed to show group management options.");
    }
  }

  private async handleInfo(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Use `/create_group` to create a new group.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(ajoGroup);
      const activePolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 **Group: ${ajoGroup.name}**

💰 **Capital:** ${ajoGroup.current_balance} SOL
👥 **Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
📈 **Status:** ${ajoGroup.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${ajoGroup.trades.length}

**Group ID:** \`${ajoGroup._id}\`
**Created:** ${new Date(ajoGroup.created_at).toLocaleDateString()}
      `;

      await ctx.reply(infoMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Info error:", error);
      await ctx.reply("❌ Failed to get info.");
    }
  }

  private async handleMembers(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get financial summary for member details
      const financialSummary = getGroupFinancialSummary(ajoGroup);

      let membersMessage = `👥 **Members (${ajoGroup.members.length}/${ajoGroup.max_members})**\n\n`;

      // Sort members by contribution (highest first)
      const sortedMembers = [...ajoGroup.members].sort(
        (a: any, b: any) => b.contribution - a.contribution
      );

      sortedMembers.forEach((member: any, index: any) => {
        const shareInfo = financialSummary.profit_shares.find(
          (share: any) => share.user_id === member.user_id
        );
        const sharePercentage = shareInfo ? shareInfo.share_percentage : 0;
        const role = member.role === "trader" ? "🛠️ Trader" : "👤 Member";

        membersMessage += `${index + 1}. ${role} - $${
          member.contribution
        } (${sharePercentage}%)\n`;
      });

      membersMessage += `\n**Total Balance:** ${ajoGroup.current_balance} SOL`;

      await ctx.reply(membersMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Members error:", error);
      await ctx.reply("❌ Failed to get members.");
    }
  }

  private async handleBalance(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getGroupByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await isUserMember(ajoGroup._id.toString(), userId);
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Get member's financial summary
      const memberSummary = getMemberFinancialSummary(ajoGroup, userId);
      if (!memberSummary) {
        await ctx.reply("❌ Unable to get your financial information.");
        return;
      }

      const balanceMessage = `
💰 **Your Balance**

👤 **Your Contribution:** $${memberSummary.contribution}
📊 **Your Share:** ${memberSummary.share_percentage}%
🏆 **Rank:** #${memberSummary.rank}
💎 **Role:** ${memberSummary.is_trader ? "🛠️ Trader" : "👤 Member"}

💰 **Group Balance:** ${ajoGroup.current_balance} SOL
👥 **Total Members:** ${ajoGroup.members.length}

💡 **Potential Profit Share:** $${memberSummary.potential_profit_share}
*(Based on 10% profit assumption)*
      `;

      await ctx.reply(balanceMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Balance error:", error);
      await ctx.reply("❌ Failed to get balance.");
    }
  }

  private async handleMyGroups(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get user's groups
      const userGroups = await getUserGroups(userId);

      let groupsMessage = `🏠 **Your Groups (${userGroups.length})**\n\n`;

      if (userGroups.length === 0) {
        groupsMessage += "You're not a member of any groups yet.\n\n";
        groupsMessage += "**To join a group:**\n";
        groupsMessage += "• Get a group ID from an admin\n";
        groupsMessage += "• Use: `/join <group_id>`\n\n";
        groupsMessage += "**To create a group:**\n";
        groupsMessage += "• Use: `/create_group <name> <max_members>`";
      } else {
        userGroups.forEach((group, index) => {
          const isTrader =
            group.members.find((m: any) => m.user_id === userId)?.role ===
            "trader";
          const role = isTrader ? "🛠️ Trader" : "👤 Member";

          groupsMessage += `${index + 1}. **${group.name}**\n`;
          groupsMessage += `   ${role} | ${group.current_balance} SOL\n`;
          groupsMessage += `   ${group.members.length}/${group.max_members} members\n`;
          groupsMessage += `   ID: \`${group._id}\`\n\n`;
        });
      }

      await ctx.reply(groupsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("My groups error:", error);
      await ctx.reply("❌ Failed to get your groups.");
    }
  }
}
