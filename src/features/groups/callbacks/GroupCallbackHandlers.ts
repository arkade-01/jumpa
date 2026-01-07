import { Context, Markup } from "telegraf";
import { GroupService } from "@features/groups/services/groupService";
import {
  updateGroupBalance,
  getGroupFinancialSummary,
  getMemberFinancialSummary,
} from "@features/wallets/balanceService";
import getUser from "@features/users/getUserInfo";
import { sendOrEdit } from "@shared/utils/messageHelper";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";

export class GroupCallbackHandlers {
  // Handle create callback
  static async handleCreateGroup(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🏠 Create Group");

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

      const createGroupMessage = `
<b>Create Group</b>

With group trading, you and your members can:
• Pool funds together for collective trading
• Vote on trading decisions democratically
• Share profits based on contributions
• Build wealth as a community

Use the command below to create a new group. Each telegram group is limited to one trading group at a time.

<code>/create_group (name) (blockchain) (visibility)</code>
eg: <code>/create_group MyFirstGroup base true</code>

      `;

      // Create inline keyboard with create options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("❓ Learn More", "group_help"),
          Markup.button.callback(" Back", "back_to_group_menu"),
        ],
      ]);

      await sendOrEdit(ctx, createGroupMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("Create error:", error);
      await ctx.answerCbQuery("❌ Failed to open create.");
    }
  }

  // Handle join callback
  static async handleJoinGroup(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("👥 Join Group");

      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get user's groups
      const userGroups = await GroupService.getUserGroups(userId);

      let joinGroupMessage = `
👥 **Join Group**

**How to Join a group:**
1. Get a group ID from a group admin
2. Use the command: \`/join <group_id>\` to join the group. Public groups does not require approval before you can join.


**Your Current Groups:**
`;

      if (userGroups.length === 0) {
        joinGroupMessage += "• You're not a member of any groups yet";
      } else {
        userGroups.forEach((group, index) => {
          joinGroupMessage += `• **${group.name}** (${group.members.length} members)\n`;
        });
      }

      // Create inline keyboard for join options
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔍 Browse Public Groups", "browse_groups")],
        [Markup.button.callback("📋 My Groups", "my_groups")],
        [
          Markup.button.callback("🔗 Join with ID", "join_with_id"),
          Markup.button.callback(" Back", "back_to_group_menu"),
        ],
      ]);

      await sendOrEdit(ctx, joinGroupMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Join error:", error);
      await ctx.answerCbQuery("❌ Failed to open join group.");
    }
  }

  // Handle members callback
  static async handleGroupMembers(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("👥 Members");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }
      const grpInfo = await BlockchainServiceFactory.detectAndGetService(
        group.blockchain_type
      ).fetchGroupInfo(group.group_address);
      console.log("Fetched group info group callback handler:", grpInfo.data);

      // Get financial summary for member details
      const financialSummary = getGroupFinancialSummary(group);

      let membersMessage = `👥 **Members (${grpInfo.data.members.length})**\n\n`;

      // Sort members by contribution (highest first)
      const sortedMembers = [...group.members].sort(
        (a: any, b: any) => b.contribution - a.contribution
      );

      sortedMembers.forEach((member: any, index: number) => {
        const shareInfo = financialSummary.profit_shares.find(
          (share: any) => share.user_id === member.user_id
        );
        const sharePercentage = shareInfo ? shareInfo.share_percentage : 0;
        const role = member.role === "trader" ? "🛠️ Trader" : "👤 Member";

        membersMessage += `${index + 1}. ${role} - $${
          member.contribution
        } (${sharePercentage}%)\n`;
      });

      membersMessage += `\n**Total Balance:** ${grpInfo.data.totalContributions} ${(grpInfo.data.currency as any) || "SOL"}\n`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, membersMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("members error:", error);
      await ctx.answerCbQuery("❌ Failed to get members.");
    }
  }

  // Handle balance callback
  static async handleGroupBalance(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💰 Balance");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await GroupService.isUserMember(
        group._id.toString(),
        userId
      );
      if (!isMember) {
        await ctx.reply("❌ You are not a member of this group.");
        return;
      }

      // Get member's financial summary
      const memberSummary = getMemberFinancialSummary(group, userId);
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

💰 **Group Balance:** 00 SOL
👥 **Total Members:** ${group.members.length}

💡 **Potential Profit Share:** $${memberSummary.potential_profit_share}
*(Based on 10% profit assumption)*
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, balanceMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("balance error:", error);
      await ctx.answerCbQuery("❌ Failed to get balance.");
    }
  }

  // Create group form handler
  static async handleCreateGroupForm(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🏠 Create Group Form");

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

      const formMessage = `
🏠 **Create Group - Step 1**

**Please provide the following details:**

**1. Group Name** (required)
• Choose a unique name for your group
• Max 100 characters
• Example: "GroupOne", "MoonTraders", "DeFi Squad"

**2. Maximum Members** (required)
• How many people can join your group?
• Range: 2-100 members
• Example: 10, 25, 50

**3. Minimum Contribution** (required)
• Minimum amount(in SOL) that each member must contribute before joining.
  This will be deducted upon joining the group.
• Example: 0.1, 0.5, 1.0

**Use this format:**
\`/create_group <name> <max_members> <type>\`

**Examples:**
\`/create_group GroupOne 10 0.1\`
\`/create_group MoonTraders 25 0.5\`
\`/create_group DefiSquad 50 2\`
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, formMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Create group form error:", error);
      await ctx.answerCbQuery("❌ Failed to show create form.");
    }
  }

  static async handleCustomCreate(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("⚙️ Custom Create");

      const customMessage = `
⚙️ **Custom Group Creation**

**To create a custom group, use the command:**
\`/create_group <name> <max_members> <type>\`

**Example:**
\`/create_group CryptoCrew 10 private\`

**Parameters:**
• **name**: Group name (max 100 characters)
• **max_members**: Maximum members (2-100)
• **Type**: Group Type. Can be either public or private. Private groups require admin approval to join and benefit from trades.

**Note:** You'll be the group creator and automatically become a trader!
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, customMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Custom create error:", error);
      await ctx.answerCbQuery("❌ Failed to show custom create.");
    }
  }

  static async handleGroupHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Help");

      const helpMessage = `
❓ **Group Help**

**What is a Group?**
A group is where members pool funds for collective trading.

**Key Features:**
• **Democratic Voting**: Members vote on trading decisions
• **Profit Sharing**: Profits distributed based on contributions
• **Role-Based Access**: Traders can create polls, members vote
• **Transparent**: All transactions and votes are recorded

**Group Roles:**
• **Creator**: Automatically becomes a trader
• **Trader**: Can create polls for trades and governance
• **Member**: Can vote on polls and contribute funds

**Getting Started:**
1. Create or join a group
2. Contribute funds to the group
3. Vote on trading decisions
4. Share in the profits!

**Commands:**
• \`/create_group\` - Create new group
• \`/join <id>\` - Join existing group
• \`/info\` - View group details
• \`/poll trade <token> <amount>\` - Create trade poll
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, helpMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("help error:", error);
      await ctx.answerCbQuery("❌ Failed to show help.");
    }
  }

  static async handleBrowseGroups(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🔍 Browse Groups");

      const browseMessage = `
🔍 **Browse Public Groups**

**Coming Soon!**
Public group browsing will be available in a future update.

**For now, you can:**
• Ask friends for their group ID
• Use \`/join <group_id>\` to join
• Create your own group with the buttons above
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, browseMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Browse groups error:", error);
      await ctx.answerCbQuery("❌ Failed to browse groups.");
    }
  }

  static async handleJoinWithId(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🔗 Join with ID");

      const joinMessage = `
🔗 **Join with Group ID**

**To join a group, use the command:**
\`/join <group_id>\`

**Example:**
\`/join 507f1f77bcf86cd799439011\`

**How to get a Group ID:**
• Ask the group creator or admin
• They can share it from \`/info\`
• Group ID looks like: \`507f1f77bcf86cd799439011\`
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, joinMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Join with ID error:", error);
      await ctx.answerCbQuery("❌ Failed to show join instructions.");
    }
  }

  static async handleMyGroups(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📋 My Groups");

      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Get user's groups
      const userGroups = await GroupService.getUserGroups(userId);

      let groupsMessage = `📋 **Your Groups (${userGroups.length})**\n\n`;

      if (userGroups.length === 0) {
        groupsMessage += "You're not a member of any groups yet.\n\n";
        groupsMessage += "**To join a group:**\n";
        groupsMessage += "• Get a group ID from an admin\n";
        groupsMessage += "• Use: `/join <group_id>`\n\n";
        groupsMessage += "**To create a group:**\n";
        groupsMessage += "• Use the create buttons above";
      } else {
        userGroups.forEach((group, index) => {
          const isTrader = false;
          const role = isTrader ? "🛠️ Trader" : "👤 Member";

          groupsMessage += `${index + 1}. **${group.name}**\n`;
          groupsMessage += `   ${role} | 00 SOL\n`;
          groupsMessage += `   ${group.members.length} members\n`;
          groupsMessage += `   ID: \`${group._id}\`\n\n`;
        });
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, groupsMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("My groups error:", error);
      await ctx.answerCbQuery("❌ Failed to get your groups.");
    }
  }

  static async handleGroupStats(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📊 Group Stats");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(group);
      const activePolls = group.polls.filter(
        (poll: any) => poll.status === "open"
      );
      const executedPolls = group.polls.filter(
        (poll: any) => poll.status === "executed"
      );

      const statsMessage = `
📊 **Group Statistics**

**📈 Performance:**
• Total Trades: ${group.trades.length}
• Successful Trades: ${
        executedPolls.filter((p: any) => p.type === "trade").length
      }
• Active Polls: ${activePolls.length}
• Total Polls: ${group.polls.length}

**💰 Financial:**
• Current Balance: 000 SOL
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

**👥 Members:**
• Total Members: ${group.members.length}
• Max Capacity: 000
• Traders: ${group.members.filter((m: any) => m.role === "trader").length}
• Regular Members: ${
        group.members.filter((m: any) => m.role === "member").length
      }

**⚙️ Settings:**
• Group Status: 
• Created: ${new Date(group.createdAt).toLocaleDateString()}
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, statsMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Group stats error:", error);
      await ctx.answerCbQuery("❌ Failed to get group stats.");
    }
  }

  /**
   * Copy group ID handler
   */
  static async handleCopyGroupId(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📋 Group ID Copied");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const copyMessage = `
📋 **Group ID Ready to Share**

**Group:** ${group.name}
**Group ID:** \`${group._id}\`

**Share this with people you want to invite:**
\`/join ${group._id}\`

**Or share this message:**
"Join my group '${group.name}' using: /join ${group._id}"

**Current Status:**
• Members: ${group.members.length}
• Available Slots: ${group.members.length}
• Status: 
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, copyMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Copy group ID error:", error);
      await ctx.answerCbQuery("❌ Failed to copy group ID.");
    }
  }

  /**
   * Handle refresh group management panel
   */
  static async handleGroupManageRefresh(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🔄 Refreshing...");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const managementMessage = `
**${group.name}**

**Group ID:** \`${group._id}\`
**Status:** 
**Balance:** ${0} SOL
      `;

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
          Markup.button.callback("🔙 Back to Group Menu", "back_to_group_menu"),
        ],
      ]);

      await sendOrEdit(ctx, managementMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Group manage refresh error:", error);
      await ctx.answerCbQuery("❌ Failed to refresh.");
    }
  }

  /**
   * Handle more actions panel - shows additional admin options
   */
  static async handleMoreActions(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("➕ More Actions");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await GroupService.getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const moreActionsMessage = `
🎛️ **${group.name} - Admin Actions**

**Group ID:** \`${group._id}\`
**Status:** 

Select an action below:
      `;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("💸 Distribute Profit", "group_distribute"),
          Markup.button.callback("➖ Remove Member", "group_remove_member"),
        ],
        [
          Markup.button.callback("👤 Add Trader", "group_add_trader"),
          Markup.button.callback("🚫 Remove Trader", "group_remove_trader"),
        ],
        [
          Markup.button.callback("🔒 Add to Blacklist", "group_add_blacklist"),
          Markup.button.callback(
            "🔓 Remove from Blacklist",
            "group_remove_blacklist"
          ),
        ],
        [Markup.button.callback("🔴 Close Group", "group_close")],
        [
          Markup.button.callback(
            "⬅️ Back to Group Menu",
            "group_manage_refresh"
          ),
        ],
      ]);

      await sendOrEdit(ctx, moreActionsMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("More actions error:", error);
      await ctx.answerCbQuery("❌ Failed to show more actions.");
    }
  }
}
