import { Context, Markup } from "telegraf";
import { BaseCommand } from "@telegram/commands/BaseCommand";
import getUser from "@features/users/getUserInfo";

export class DepositCommand extends BaseCommand {
  name = "deposit";
  description = "Deposit funds into your wallet";

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

      const user = await getUser(telegramId, username);

      const hasSolanaWallet =
        user.solanaWallets &&
        user.solanaWallets.length > 0 &&
        user.solanaWallets[0].address;

      const hasEvmWallet =
        user.evmWallets &&
        user.evmWallets.length > 0 &&
        user.evmWallets[0].address;

      let message = "*Deposit Funds*\n\n";

      if (!hasSolanaWallet && !hasEvmWallet) {
        message += "You haven't set up any wallets yet. Please use the /start command to create a wallet first.\n\n";
      } else {
        message += "You can deposit funds by sending USDC or USDT to your wallet addresses below:\n\n";

        if (hasSolanaWallet) {
          message += "*Solana (USDC/USDT)*\n";
          message += `\`${user.solanaWallets[0].address}\`\n\n`;
        }

        if (hasEvmWallet) {
          message += "*Base (USDC/USDT)*\n";
          message += `\`${user.evmWallets[0].address}\`\n\n`;
        }
      }

      message += "Or deposit directly from your bank account by clicking the button below.";

      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("Deposit from Bank", "deposit_from_bank"),
          Markup.button.callback("⬅️ Back", "back_to_menu")]
        ])
      });

    } catch (error) {
      console.error("Deposit command error:", error);
      await this.sendMessage(
        ctx,
        "❌ An error occurred while fetching your deposit options."
      );
    }
  }
}
