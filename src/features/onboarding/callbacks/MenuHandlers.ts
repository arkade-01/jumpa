import { Context, Markup } from "telegraf";
import { displayMainMenu } from "@features/onboarding/utils/displayMainMenu";
import { sendOrEdit } from "@shared/utils/messageHelper";
import { GroupService } from "@features/groups/services/groupService";
import { BlockchainServiceFactory } from "@blockchain/shared/BlockchainServiceFactory";

export class MenuHandlers {
  // Handle back to main menu callback
  static async handleBackToMenu(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🏠 Back to Main Menu");

      // Use the shared displayMainMenu function
      await displayMainMenu(ctx, telegramId, username);
    } catch (error) {
      console.error("Back to menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to main menu.");
    }
  }

  // Handle refresh balances callback - force refresh from blockchain
  static async handleRefreshBalances(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔄 Refreshing balances...");

      // Display main menu with force refresh enabled
      await displayMainMenu(ctx, telegramId, username, true);
    } catch (error) {
      console.error("Refresh balances error:", error);
      await ctx.answerCbQuery("❌ Failed to refresh balances.");
    }
  }

  /**
   * Handle back to group menu callback
   */
  static async handleBackToGroupMenu(ctx: Context): Promise<void> {
    try {
      if (!ctx.from?.id) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🏠 Back to Groups");

      const chatId = ctx.chat?.id;
      if (!chatId) {
        await ctx.reply("❌ Unable to identify chat.");
        return;
      }

      // Check if this chat has a group
      const group = await GroupService.getGroupByChatId(chatId);

      if (!group) {
        // No group in this chat - show create/join options
        const groupMenuMessage = `
🏠 **Groups**

**What would you like to do?**

• **Create Group** - Start your own trading group
• **Join Group** - Join an existing trading group
        `;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("🏠 Create Group", "create_group"),
            Markup.button.callback("👥 Join Group", "join"),
          ],
          [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")],
        ]);

        await sendOrEdit(ctx, groupMenuMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        return;
      }

      // Group exists - show group management panel
      //get group info on chain

      const grpInfo = await BlockchainServiceFactory.detectAndGetService(
        group.blockchain_type
      ).fetchGroupInfo(group.group_address);
      console.log("Fetched group info menu handler:", grpInfo);
      const managementMessage = `
 **Group: ${grpInfo.data.name}**

**Group ID:** \`${grpInfo.data.groupAddress}\`
**Type:** ${grpInfo.data.isPrivate
          ? "🔒 Private (requires approval)"
          : "🌐 Public (auto-approved)"
        }
**Status:** ${(grpInfo.data.state as any) === "open" ? "🟢 Active" : "🔴 Paused"
        }
**Balance:** ${(grpInfo.data.totalContributions as any) || 0} ${(grpInfo.data.currency as any) || "SOL"
        }
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
          Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
        ],
      ]);

      await sendOrEdit(ctx, managementMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Back to group menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to group menu.");
    }
  }
}
