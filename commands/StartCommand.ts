import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import getUser from "../services/getUserInfo";
import { Markup } from "telegraf";

export class StartCommand extends BaseCommand {
  name = "start";
  description = "Start the bot and show welcome message";

  async execute(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await this.sendMessage(
          ctx,
          "❌ Unable to identify your Telegram account. Please try again."
        );
        return;
      }

      // Use your existing getUser service
      const user = await getUser(telegramId, username);

      if (user) {
        const firstName = ctx.from?.first_name || username;
        const welcomeMessage = `Welcome to Jumpa Ajo Bot, ${firstName}!

 *Your Wallet:*
\`${user.wallet_address}\`

 *Balance:* ${user.user_balance} SOL

 Ready to start collaborative trading!

_Tap the wallet address above to copy it_`;

        // Create inline keyboard for quick actions
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(" View Wallet", "view_wallet"),
            Markup.button.callback(" My Profile", "view_profile"),
          ],
          [
            Markup.button.callback(" Create  Group", "create_ajo"),
            Markup.button.callback(" Join  Group", "join_ajo"),
          ],
          [
            Markup.button.callback(" Group Info", "ajo_info"),
          ],
          [
            Markup.button.callback("Deposit", "deposit_sol"),
            Markup.button.callback("Withdraw", "withdraw_sol"),
          ],
          [
            Markup.button.callback(" Help & Commands", "show_help"),
            Markup.button.callback(" About Jumpa", "show_about"),
          ],
        ]);

        await ctx.reply(welcomeMessage, {
          parse_mode: "Markdown",
          ...keyboard,
        });
      }
    } catch (error) {
      console.error("Start command error:", error);
      await this.sendMessage(
        ctx,
        "❌ An error occurred. Please try again later."
      );
    }
  }
}
