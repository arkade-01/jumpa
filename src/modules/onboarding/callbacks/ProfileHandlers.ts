import { Context } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { Markup } from "telegraf";
import { getUserGroups } from "@modules/groups/groupService";
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
      const userGroups = await getUserGroups(telegramId);

      const profileMessage = `
      <b>📊 Your Profile</b>

<b>Wallet Address:</b> ${hasSolanaWallet ? `<code>${user.solanaWallets[0].address}</code>` : "Wallet not set"}

<b>Balance:</b> ${hasSolanaWallet ? `${(user.solanaWallets[0].balance).toFixed(4)} SOL` : "N/A"}

<b>Member Since:</b> ${user.created_at?.toLocaleString() || "Unknown"}

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
