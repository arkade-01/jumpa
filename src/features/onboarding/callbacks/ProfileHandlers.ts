import { Context } from "telegraf";
import getUser from "@features/users/getUserInfo";
import { Markup } from "telegraf";
import { GroupService } from "@features/groups/services/groupService";
import { sendOrEdit } from "@shared/utils/messageHelper";

export class ProfileHandlers {
  // Handle view profile callback
  static async handleViewProfile(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("📊 Loading profile...");

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }
      // Check if user has a solana wallet
      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      // Get user's groups
      const userGroups = await GroupService.getUserGroups(telegramId);

      const profileMessage = `
      <b>📊 Your Profile</b>

<b>Username:</b> @${username}

<b>Joined on:</b> ${user.createdAt ? (() => {
          const date = new Date(user.createdAt);
          const day = date.getDate();
          const suffix = ["th", "st", "nd", "rd"][((day % 100) - 20) % 10] || ["th", "st", "nd", "rd"][day % 10] || "th";
          return `${day}${suffix} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        })() : "Unknown"}

<b>Groups:</b> ${userGroups.length}
      `;
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🏧 Bank Details", "view_bank_account"),
          Markup.button.callback("✍️ Update Bank Details", "update_bank_name"),
        ], [
          Markup.button.callback("Backup Wallet", "export_private_key"),
          Markup.button.callback("Back to Main Menu", "back_to_menu")],
      ]);

      await sendOrEdit(ctx, profileMessage, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } catch (error) {
      console.error("View profile error:", error);
      await ctx.answerCbQuery("❌ Failed to load profile.");
    }
  }
}
