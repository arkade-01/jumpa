import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import getUser from "@modules/users/getUserInfo";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";

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
        // Check if user has a solana wallet
        const hasSolanaWallet =
          user.solanaWallets &&
          user.solanaWallets.length > 0 &&
          user.solanaWallets[0].address;

        if (!hasSolanaWallet) {
          // Show wallet setup options
          const firstName = ctx.from?.first_name || username;
          const setupMessage = `Welcome to Jumpa Bot, ${firstName}!

🔐 **Wallet Setup Required**

You need to set up a Solana wallet to continue.

Choose an option:`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Generate New Solana Wallet", "generate_wallet"),],
            [Markup.button.callback("📥 Import Existing Solana Wallet", "import_wallet"),],
          ]);

          await ctx.reply(setupMessage, {
            parse_mode: "Markdown",
            ...keyboard,
          });
          return;
        }

        // User has wallet, show normal menu
        const firstName = ctx.from?.first_name || username;

        // Fetch USDT and USDC balance
        const tokenBalances = await getAllTokenBalances(user.solanaWallets[0].address);

        const welcomeMessage = `Welcome to Jumpa Bot, ${firstName}!

 *--- Your Solana Wallet ---*

\`${user.solanaWallets[0].address}\`

SOL: ${(user.solanaWallets[0].balance).toFixed(4)}   • USDC: ${tokenBalances.usdc.toFixed(1)}   • USDT: ${tokenBalances.usdt.toFixed(1)}

`;

        // Create inline keyboard for quick actions
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(" View Wallet", "view_wallet"),
            Markup.button.callback(" My Profile", "view_profile"),
          ],
          [
            Markup.button.callback(" Create Group", "create_group"),
            Markup.button.callback(" Join  Group", "join_group"),
          ],
          [
            Markup.button.callback(" Group Info", "group_info"),
          ],
          [
            Markup.button.callback("Deposit", "deposit_sol"),
            Markup.button.callback("Withdraw", "withdraw_sol"),
          ],
          [
            Markup.button.callback(" Help & Commands", "show_help"),
            Markup.button.callback(" About Jumpa", "show_about"),
          ],
          [Markup.button.callback("🔄 Refresh", "back_to_menu")] //fix this later
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
