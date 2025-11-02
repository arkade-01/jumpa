import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import getUser from "@modules/users/getUserInfo";
import { Markup } from "telegraf";

export class WalletCommand extends BaseCommand {
  name = "wallet";
  description = "Show wallet information and options";

  async execute(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await this.sendMessage(
          ctx,
          "❌ Unable to identify your Telegram account."
        );
        return;
      }

      // Get user info
      const user = await getUser(telegramId, username);

      if (!user) {
        await this.sendMessage(
          ctx,
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      // Create wallet info message
      const walletMessage = `
🔑 **Your Solana Wallet**

📍 **Address:** \`${user.solanaWallets[0].address}\`
💰 **Balance:** ${user.solanaWallets[0].balance} SOL
📅 **Last Updated:** ${user.solanaWallets[0].last_updated_balance.toLocaleString()}

⚠️ **Security Note:** Keep your private key secure!
      `;

      // Create inline keyboard with options
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔄 Refresh Balance", "refresh_balance"),
          Markup.button.callback("📋 Copy Address", "copy_address"),
        ],
        [
          Markup.button.callback("🔐 Show Private Key", "show_private_key"),
          Markup.button.callback("📊 Wallet Details", "wallet_details"),
        ],
        [Markup.button.callback("❌ Close", "close_wallet")],
      ]);

      await ctx.reply(walletMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Wallet command error:", error);
      await this.sendMessage(
        ctx,
        "❌ An error occurred while fetching wallet information. Please try again later."
      );
    }
  }
}
