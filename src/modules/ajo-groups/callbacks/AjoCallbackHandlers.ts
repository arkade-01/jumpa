import { Context, Markup } from "telegraf";
import {
  createAjo,
  joinAjo,
  getAjoInfo,
  getAjoByChatId,
  getUserAjoGroups,
  isUserMember,
  isUserTrader,
} from "@modules/ajo-groups/ajoService";
import {
  createPoll,
  voteOnPoll,
  getGroupPolls,
  getPollResults,
  processExpiredPolls,
} from "@modules/governance/pollService";
import {
  validateAjoCreation,
  validatePollCreation,
  validateGroupId,
  validateAndSanitizeGroupName,
} from "@modules/ajo-groups/ajoValidation";
import {
  updateGroupBalance,
  getGroupFinancialSummary,
  getMemberFinancialSummary,
} from "@modules/wallets/balanceService";
import getUser from "@modules/users/getUserInfo";

export class AjoCallbackHandlers {
  // Handle create callback
  static async handleCreateAjo(ctx: Context): Promise<void> {
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

      const createAjoMessage = `
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
        [Markup.button.callback("❓ Learn More", "ajo_help")],
      ]);

      await ctx.reply(createAjoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Create error:", error);
      await ctx.answerCbQuery("❌ Failed to open create.");
    }
  }

  // Handle join callback
  static async handleJoinAjo(ctx: Context): Promise<void> {
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
      const userGroups = await getUserAjoGroups(userId);

      let joinAjoMessage = `
👥 **Join Group**

**How to Join a group:**
1. Get a group ID from an group admin
2. Use the command: \`/join <group_id>\`
3. Send your contribution to the group
4. Start voting on trading decisions!

**Your Current Groups:**
`;

      if (userGroups.length === 0) {
        joinAjoMessage += "• You're not a member of any groups yet";
      } else {
        userGroups.forEach((group, index) => {
          joinAjoMessage += `• **${group.name}** (${group.members.length}/${group.max_members} members)\n`;
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

      await ctx.reply(joinAjoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Join error:", error);
      await ctx.answerCbQuery("❌ Failed to open join group.");
    }
  }

  // Handle info callback
  static async handleAjoInfo(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("📊 Group Info");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Use /create_group to create a new group or /join to join an existing one."
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
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
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
        [Markup.button.callback("🔄 Refresh", "group_info")],
      ]);

      await ctx.reply(infoMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("info error:", error);
      await ctx.answerCbQuery("❌ Failed to get info.");
    }
  }

  // Handle members callback
  static async handleAjoMembers(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("👥 Members");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
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

      membersMessage += `\n**Total Balance:** ${ajoGroup.current_balance} SOL`;

      await ctx.reply(membersMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("members error:", error);
      await ctx.answerCbQuery("❌ Failed to get members.");
    }
  }

  // Handle polls callback
  static async handleAjoPolls(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("🗳️ Polls");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Process expired polls first
      await processExpiredPolls(ajoGroup._id.toString());

      // Get active polls
      const { polls } = await getGroupPolls(ajoGroup._id.toString(), "open");

      let pollsMessage = `🗳️ **Active Polls (${polls.length})**\n\n`;

      if (polls.length === 0) {
        pollsMessage += "No active polls at the moment.\n\n";
        pollsMessage += "**Traders can create polls using:**\n";
        pollsMessage +=
          "• `/poll_trade <token> <amount>` - Create trade poll\n";
        pollsMessage += "• `/poll_end` - Create end poll";
      } else {
        polls.forEach((poll: any, index: number) => {
          const timeLeft = Math.max(
            0,
            Math.floor(
              (new Date(poll.expires_at).getTime() - new Date().getTime()) /
                (1000 * 60 * 60)
            )
          );
          const votes = poll.votes.length;

          pollsMessage += `${index + 1}. **${poll.title}**\n`;
          pollsMessage += `   Type: ${
            poll.type === "trade" ? "🔄 Trade" : "🏁 End Group Trade"
          }\n`;
          pollsMessage += `   Votes: ${votes} | Time left: ${timeLeft}h\n`;
          pollsMessage += `   ID: \`${poll.id}\`\n\n`;
        });

        pollsMessage += "**Vote using:** `/vote <poll_id> <yes/no>`";
      }

      await ctx.reply(pollsMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("polls error:", error);
      await ctx.answerCbQuery("❌ Failed to get polls.");
    }
  }

  // Handle balance callback
  static async handleAjoBalance(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("💰 Balance");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Get group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
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

      await ctx.reply(balanceMessage, {
        parse_mode: "Markdown",
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
  This will be deducted upon joinin the group.
• Example: 0.1, 0.5, 1.0

**4. Consensus Threshold** (optional)
• What percentage of votes needed to approve decisions?
• Range: 50-100% (default: 67%)
• Example: 60, 75, 80

**Use this format:**
\`/create_group <name> <max_members> <amount> [consensus_threshold]\`

**Examples:**
\`/create_group GroupOne 10 0.1 67\`
\`/create_group MoonTraders 25 0.5\`
\`/create_group DeFi Squad 50 2 75\`
      `;

      await ctx.reply(formMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Create group form error:", error);
      await ctx.answerCbQuery("❌ Failed to show create form.");
    }
  }

  // Add members form handler
  static async handleAddMembersForm(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("👥 Add Members Form");

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Check if this chat has an group
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No group found in this chat.\n\n" +
            "Create a group first using the 'Create New Group' button.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is a trader
      const isTrader = await isUserTrader(ajoGroup._id.toString(), userId);
      if (!isTrader) {
        await ctx.reply("❌ Only traders can add members to the group.");
        return;
      }

      const formMessage = `
👥 **Add Members to Group - Step 1**

**Current Group:** ${ajoGroup.name}
**Current Members:** ${ajoGroup.members.length}/${ajoGroup.max_members}
**Available Slots:** ${ajoGroup.max_members - ajoGroup.members.length}

**How to Add Members:**

**Method 1: Share Group ID**
• Share this Group ID: \`${ajoGroup._id}\`
• They can join using: \`/join ${ajoGroup._id}\`

**Method 2: Direct Add (Coming Soon)**
• Add members by their Telegram username
• Use: \`/add_member @username\`

**Method 3: Invite Link (Coming Soon)**
• Generate invite links for easy joining
• Use: \`/generate_invite\`

**Current Members:**

${ajoGroup.members
  .map(
    (member: any, index: number) =>
      `${index + 1}. ${member.role === "trader" ? "🛠️" : "👤"} Member (ID: ${
        member.user_id
      })`
  )
  .join("\n")}
      `;

      // Create inline keyboard for member management
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("📋 Copy Group ID", "copy_group_id"),
          Markup.button.callback("📊 View Members", "group_members"),
        ],
        [Markup.button.callback("🔄 Refresh", "add_members_form")],
      ]);

      await ctx.reply(formMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Add members form error:", error);
      await ctx.answerCbQuery("❌ Failed to show add members form.");
    }
  }

  static async handleCustomCreate(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("⚙️ Custom Create");

      const customMessage = `
⚙️ **Custom Group Creation**

**To create a custom group, use the command:**
\`/create_group <name> <max_members> <amount> [consensus_threshold]\`

**Example:**
\`/create_group CryptoCrew 10 0.5 67\`

**Parameters:**
• **name**: Group name (max 100 characters)
• **max_members**: Maximum members (2-100)
• **amount**: Minimum contribution in SOL (at least 0.05)
• **consensus_threshold**: Voting threshold % (50-100, default: 67)

**Note:** You'll be the group creator and automatically become a trader!
      `;

      await ctx.reply(customMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Custom create error:", error);
      await ctx.answerCbQuery("❌ Failed to show custom create.");
    }
  }

  static async handleAjoHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Help");

      const helpMessage = `
❓ **Group Help**

**What is an Group?**
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
1. Create or join an group
2. Contribute funds to the group
3. Vote on trading decisions
4. Share in the profits!

**Commands:**
• \`/create\` - Create new group
• \`/join <id>\` - Join existing group
• \`/info\` - View group details
• \`/poll trade <token> <amount>\` - Create trade poll
      `;

      await ctx.reply(helpMessage, { parse_mode: "Markdown" });
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

      await ctx.reply(browseMessage, { parse_mode: "Markdown" });
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

      await ctx.reply(joinMessage, { parse_mode: "Markdown" });
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
      const userGroups = await getUserAjoGroups(userId);

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
          const isTrader = group.members.find(
            (m: any) => m.user_id === userId
          )?.role === "trader";
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
      await ctx.answerCbQuery("❌ Failed to get your groups.");
    }
  }

  static async handleJoinHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Join Help");

      const helpMessage = `
❓ **How to Join an Group**

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

      await ctx.reply(helpMessage, { parse_mode: "Markdown" });
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
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      // Get financial summary
      const financialSummary = getGroupFinancialSummary(ajoGroup);
      const activePolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "open"
      );
      const executedPolls = ajoGroup.polls.filter(
        (poll: any) => poll.status === "executed"
      );

      const statsMessage = `
📊 **Group Statistics**

**📈 Performance:**
• Total Trades: ${ajoGroup.trades.length}
• Successful Trades: ${executedPolls.filter((p: any) => p.type === "trade").length}
• Active Polls: ${activePolls.length}
• Total Polls: ${ajoGroup.polls.length}

**💰 Financial:**
• Current Balance: ${ajoGroup.current_balance} SOL
• Total Contributions: $${financialSummary.total_contributions}
• Average Contribution: $${financialSummary.average_contribution}
• Largest Contribution: $${financialSummary.largest_contribution}

**👥 Members:**
• Total Members: ${ajoGroup.members.length}
• Max Capacity: ${ajoGroup.max_members}
• Traders: ${ajoGroup.members.filter((m: any) => m.role === "trader").length}
• Regular Members: ${
        ajoGroup.members.filter((m: any) => m.role === "member").length
      }

**⚙️ Settings:**
• Consensus Threshold: ${ajoGroup.consensus_threshold}%
• Group Status: ${ajoGroup.status}
• Created: ${new Date(ajoGroup.created_at).toLocaleDateString()}
      `;

      await ctx.reply(statsMessage, { parse_mode: "Markdown" });
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
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply("❌ No group found in this chat.");
        return;
      }

      const copyMessage = `
📋 **Group ID Ready to Share**

**Group:** ${ajoGroup.name}
**Group ID:** \`${ajoGroup._id}\`

**Share this with people you want to invite:**
\`/join ${ajoGroup._id}\`

**Or share this message:**
"Join my group '${ajoGroup.name}' using: /join ${ajoGroup._id}"

**Current Status:**
• Members: ${ajoGroup.members.length}/${ajoGroup.max_members}
• Available Slots: ${ajoGroup.max_members - ajoGroup.members.length}
• Status: ${ajoGroup.status === "active" ? "🟢 Active" : "🔴 Ended"}
      `;

      await ctx.reply(copyMessage, { parse_mode: "Markdown" });
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
2. Use \`/create_group <name> <max_members>\` to create your group
3. Share the group ID with members
4. Start trading!

**Bot Commands for Groups:**
• \`/create_group\` - Create group
• \`/info\` - View group info
• \`/members\` - See members
• \`/poll trade <token> <amount>\` - Create trade poll
• \`/vote <poll_id> <yes/no>\` - Vote on polls

**Important Notes:**
• The bot must be added to the group before creating  group
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

      await ctx.reply(addBotMessage, {
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
• \`/create_group <name> <max_members> <amount> [consensus]\` - Create group
• \`/info\` - View group information
• \`/members\` - List group members
• \`/polls\` - Show active polls
• \`/balance\` - Show your balance
• \`/add_member <group_id>\` - Join a group

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
• \`/create_group CryptoCrew 10 0.1 67\`
• \`/poll trade BONK 1000\`
• \`/vote 507f1f77bcf86cd799439012 yes\`
• \`/add_member 507f1f77bcf86cd799439011\`

**Roles:**
• **Creator**: Automatically becomes trader
• **Trader**: Can create polls and execute trades
• **Member**: Can vote on polls and contribute funds
      `;

      await ctx.reply(commandsMessage, { parse_mode: "Markdown" });
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

      await ctx.reply(permissionsMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Bot permissions help error:", error);
      await ctx.answerCbQuery("❌ Failed to show permissions info.");
    }
  }
}
