import { Context, Markup } from "telegraf";
import {
  createGroup,
  joinGroup,
  getGroupInfo,
  getGroupByChatId,
  getUserGroups,
  isUserMember,
  isUserTrader,
} from "@modules/groups/groupService";

import {
  updateGroupBalance,
  getGroupFinancialSummary,
  getMemberFinancialSummary,
} from "@modules/wallets/balanceService";
import getUser from "@modules/users/getUserInfo";
import { sendOrEdit } from "@shared/utils/messageHelper";

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
**Create Group**

**Why Group Trading?**

With group trading, you and your members can:
• Pool funds together for collective trading
• Vote on trading decisions democratically
• Share profits based on contributions
• Build wealth as a community

      `;

      // Create inline keyboard with create options
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🏠 Create New Group", "create_group_form")],
        [Markup.button.callback("👥 Add Members to Group", "add_members_form")],
        [
          Markup.button.callback(
            "🤖 Add Bot to Telegram Group",
            "add_bot_to_group"
          ),
        ],
        [Markup.button.callback("❓ Learn More", "group_help")],
      ]);

      await sendOrEdit(ctx, createGroupMessage, {
        parse_mode: "Markdown",
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
      const userGroups = await getUserGroups(userId);

      let joinGroupMessage = `
👥 **Join Group**

**How to Join a group:**
1. Get a group ID from a group admin
2. Use the command: \`/join <group_id>\`
3. Send your contribution to the group
4. Start voting on trading decisions!

**Your Current Groups:**
`;

      if (userGroups.length === 0) {
        joinGroupMessage += "• You're not a member of any groups yet";
      } else {
        userGroups.forEach((group, index) => {
          joinGroupMessage += `• **${group.name}** (${group.members.length}/${group.max_members} members)\n`;
        });
      }

      // Create inline keyboard for join options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔍 Browse Public Groups", "browse_groups"),
          Markup.button.callback("🔗 Join with ID", "join_with_id"),
        ],
        [Markup.button.callback("📋 My Groups", "my_groups")],
        [Markup.button.callback("❓ How to Join", "join_help")],
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

  // Handle info callback
  static async handleGroupInfo(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📊 Group Info");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Use /create_group to create a new group or /join to join an existing one."
        );
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(group);
      const activePolls = group.polls.filter(
        (poll: any) => poll.status === "open"
      );

      const infoMessage = `
📊 **Group: ${group.name}**

💰 **Capital:** ${group.current_balance} SOL
👥 **Members:** ${group.members.length}/${group.max_members}
📈 **Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}

📊 **Financial Summary:**
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

🗳️ **Active Polls:** ${activePolls.length}
📈 **Total Trades:** ${group.trades.length}

**Group ID:** \`${group._id}\`
**Created:** ${new Date(group.created_at).toLocaleDateString()}
      `;

      // Create inline keyboard for group actions
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("👥 View Members", "group_members"),
          Markup.button.callback("🗳️ View Polls", "group_polls"),
        ],
        [
          Markup.button.callback("💰 My Balance", "group_balance"),
          Markup.button.callback("📊 Group Stats", "group_stats"),
        ],
        [
          Markup.button.callback("🔄 Refresh", "group_info"),
          Markup.button.callback("🔙 Back to Groups", "back_to_group_menu"),
        ],
      ]);

      await sendOrEdit(ctx, infoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("info error:", error);
      await ctx.answerCbQuery("❌ Failed to get info.");
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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get financial summary for member details
      const financialSummary = getGroupFinancialSummary(group);

      let membersMessage = `👥 **Members (${group.members.length}/${group.max_members})**\n\n`;

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

      membersMessage += `\n**Total Balance:** ${group.current_balance} SOL`;

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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Check if user is a member
      const isMember = await isUserMember(group._id.toString(), userId);
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

💰 **Group Balance:** ${group.current_balance} SOL
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
      const userGroups = await getUserGroups(userId);

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

  static async handleJoinHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Join Help");

      const helpMessage = `
❓ **How to Join a Group**

**Step 1: Get a Group ID**
• Ask a group creator or admin for their group ID
• Group IDs look like: \`507f1f77bcf86cd799439011\`

**Step 2: Join the Group**
• Use: \`/join <group_id>\`
• Example: \`/join 507f1f77bcf86cd799439011\`

**Step 3: Contribute Funds**
• Send your contribution to the group
• Your share will be calculated based on contribution

**Step 4: Start Voting**
• Vote on trading decisions
• Share in the profits!

**Requirements:**
• You must be registered (use /start first)
• Group must have space for new members
• Group must be active (not ended)
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, helpMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Join help error:", error);
      await ctx.answerCbQuery("❌ Failed to show join help.");
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
      const group = await getGroupByChatId(chatId);
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
• Current Balance: ${group.current_balance} SOL
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

**👥 Members:**
• Total Members: ${group.members.length}
• Max Capacity: ${group.max_members}
• Traders: ${group.members.filter((m: any) => m.role === "trader").length}
• Regular Members: ${
        group.members.filter((m: any) => m.role === "member").length
      }

**⚙️ Settings:**
• Group Status: ${group.status}
• Created: ${new Date(group.created_at).toLocaleDateString()}
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
      const group = await getGroupByChatId(chatId);
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
• Members: ${group.members.length}/${group.max_members}
• Available Slots: ${group.max_members - group.members.length}
• Status: ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}
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

  // Add bot to Telegram group handler
  static async handleAddBotToGroup(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🤖 Add Bot to Group");

      const addBotMessage = `
🤖 **Add Jumpa Bot to Your Telegram Group**

**Step 1: Add the Bot**
1. Go to your Telegram group
2. Click on the group name at the top
3. Click "Add Members" or "Add Admins"
4. Search for: \`@JumpaSTradingBot\` (or your bot username)
5. Add the bot to the group

**Step 2: Give Bot Permissions**
The bot needs these permissions:
• ✅ Read messages
• ✅ Send messages
• ✅ Delete messages (for cleanup)
• ✅ Pin messages (for important polls)

**Step 3: Create Group**
Once the bot is added to your Telegram group:
1. Use \`/start\` in the group to initialize
2. Use \`/create_group <name> <max_members> <type>\` to create your group
3. Share the group ID with members
4. Start trading!

**Bot Commands for Groups:**
• \`/create_group\` - Create group
• \`/info\` - View group info
• \`/members\` - See members
• \`/poll trade <token> <amount>\` - Create trade poll
• \`/vote <poll_id> <yes/no>\` - Vote on polls

**Important Notes:**
• The bot must be added to the group before creating group
• Only group admins can create groups
• All group members can join and participate
• The bot will manage polls and voting automatically

**Need Help?**
• Use \`/help\` in the group for command list
• Contact support if you have issues
      `;

      // Create inline keyboard for bot setup
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url(
            "🔗 Add Bot to Group",
            "https://t.me/JumpaSTradingBot?startgroup=true"
          ),
        ],
        [
          Markup.button.callback("📋 Bot Commands", "bot_commands_help"),
          Markup.button.callback("⚙️ Bot Permissions", "bot_permissions_help"),
        ],
        [Markup.button.callback("🔄 Refresh", "add_bot_to_group")],
      ]);

      await sendOrEdit(ctx, addBotMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Add bot to group error:", error);
      await ctx.answerCbQuery("❌ Failed to show bot setup instructions.");
    }
  }

  // Bot commands help handler
  static async handleBotCommandsHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📋 Bot Commands");

      const commandsMessage = `
📋 **Jumpa Bot Commands**

**Group Management:**
• \`/create_group <name> <max_members> <amount>\` - Create group
• \`/info\` - View group information
• \`/members\` - List group members
• \`/polls\` - Show active polls
• \`/balance\` - Show your balance
• \`/join <group_id>\` - Join a group

**Polling & Voting:**
• \`/poll trade <token> <amount>\` - Create trade poll (traders only)
• \`/poll end\` - Create end poll (traders only)
• \`/vote <poll_id> <yes/no>\` - Vote on polls
• \`/poll results <poll_id>\` - View poll results
• \`/poll execute <poll_id>\` - Execute poll (traders only)

**User Management:**
• \`/start\` - Initialize bot and create wallet
• \`/wallet\` - View wallet information
• \`/profile\` - View user profile
• \`/help\` - Show help message

**Examples:**
• \`/create_group CryptoCrew 10 0.1\`
• \`/poll trade BONK 1000\`
• \`/vote 507f1f77bcf86cd799439012 yes\`
• \`/join 507f1f77bcf86cd799439011\`

**Roles:**
• **Creator**: Automatically becomes trader
• **Trader**: Can create polls and execute trades
• **Member**: Can vote on polls and contribute funds
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, commandsMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Bot commands help error:", error);
      await ctx.answerCbQuery("❌ Failed to show commands.");
    }
  }

  // Bot permissions help handler
  static async handleBotPermissionsHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("⚙️ Bot Permissions");

      const permissionsMessage = `
⚙️ **Required Bot Permissions**

**Essential Permissions:**
• ✅ **Read Messages** - Bot needs to read commands and messages
• ✅ **Send Messages** - Bot needs to send responses and notifications
• ✅ **Delete Messages** - Bot needs to clean up old polls and messages
• ✅ **Pin Messages** - Bot needs to pin important polls and announcements

**Optional Permissions:**
• 🔄 **Edit Messages** - For updating poll status in real-time
• 📎 **Send Media** - For sending charts and trading data
• 👥 **Invite Users** - For adding members to groups (future feature)

**How to Set Permissions:**
1. Add bot to your group
2. Go to group settings
3. Click "Administrators"
4. Find the bot in the list
5. Click on the bot
6. Enable the required permissions
7. Save changes

**Permission Issues:**
If the bot doesn't work properly:
• Check that all essential permissions are enabled
• Make sure the bot is not restricted
• Try removing and re-adding the bot
• Contact support if issues persist

**Security Note:**
The bot only needs these permissions to function properly. It won't:
• Access your personal messages
• Share your data with third parties
• Perform unauthorized actions
      `;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Back to Groups", "back_to_group_menu")],
      ]);

      await sendOrEdit(ctx, permissionsMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Bot permissions help error:", error);
      await ctx.answerCbQuery("❌ Failed to show permissions info.");
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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const managementMessage = `
**${group.name}**

**Group ID:** \`${group._id}\`
**Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}
**Balance:** ${group.current_balance || 0} SOL
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
          Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
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
      const group = await getGroupByChatId(chatId);
      if (!group) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const moreActionsMessage = `
🎛️ **${group.name} - Admin Actions**

**Group ID:** \`${group._id}\`
**Status:** ${group.status === "active" ? "🟢 Active" : "🔴 Ended"}

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
