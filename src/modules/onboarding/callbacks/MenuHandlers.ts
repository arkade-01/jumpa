import { Context, Markup } from "telegraf";
import { displayMainMenu } from "@modules/onboarding/utils/displayMainMenu";
import { sendOrEdit } from "@shared/utils/messageHelper";
import { getGroupByChatId } from "@modules/groups/groupService";

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

  // Handle back to group menu callback
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
      const group = await getGroupByChatId(chatId);

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
          [
            Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
          ],
        ]);

        await sendOrEdit(ctx, groupMenuMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
        return;
      }

      // Group exists - show group management panel
      const managementMessage = `
 **${group.name}**

**Group ID:** \`${group._id}\`
**Type:** ${group.is_private ? "🔒 Private (requires approval)" : "🌐 Public (auto-approved)"}
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
      console.error("Back to group menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to group menu.");
    }
  }
}
