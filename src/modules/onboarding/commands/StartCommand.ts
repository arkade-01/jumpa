import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import getUser from "@modules/users/getUserInfo";
import { Markup } from "telegraf";
import { getAllTokenBalances } from "@shared/utils/getTokenBalances";
import { encodeBase62, decodeBase62 } from "@shared/utils/base62";
import User from "@database/models/user";

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

      // Parse referral code from start parameter (e.g., /start ref_ABC123)
      // Extract the parameter from the message text
      let referrerTelegramId: number | null = null;

      if (ctx.message && 'text' in ctx.message && ctx.message.text) {
        const messageText = ctx.message.text;
        console.log(`Start command received with text: "${messageText}"`);
        const parts = messageText.split(' ');

        // Check if there's a parameter after /start
        if (parts.length > 1) {
          const startPayload = parts[1];
          console.log(`Start payload detected: "${startPayload}"`);

          if (startPayload.startsWith("ref_")) {
            try {
              const referralCode = startPayload.substring(4); // Remove "ref_" prefix
              referrerTelegramId = decodeBase62(referralCode);
              console.log(`✅ Referral code parsed successfully: ${referralCode} → Referrer ID: ${referrerTelegramId}`);
            } catch (error) {
              console.error("❌ Invalid referral code:", error);
            }
          }
        }
      }

      // Check if user already exists
      const existingUser = await User.findOne({ telegram_id: telegramId });
      const isNewUser = !existingUser;

      // Use your existing getUser service
      const user = await getUser(telegramId, username);

      // Generate referral code for new user if they don't have one
      if (!user.referrals?.referralCode) {
        const referralCode = encodeBase62(telegramId);
        user.referrals = {
          ...user.referrals,
          referralCode,
          referralPoints: user.referrals?.referralPoints || 0,
          referredBy: user.referrals?.referredBy || null,
          totalReferrals: user.referrals?.totalReferrals || 0,
          myReferrals: user.referrals?.myReferrals || [],
        };
        await user.save();
      }

      // Handle referral linking for new users
      console.log(`Referral check - isNewUser: ${isNewUser}, referrerTelegramId: ${referrerTelegramId}, telegramId: ${telegramId}`);

      if (
        isNewUser &&
        referrerTelegramId &&
        referrerTelegramId !== telegramId
      ) {
        console.log(`Attempting to link referral for new user ${telegramId} with referrer ${referrerTelegramId}`);

        // Find the referrer
        const referrer = await User.findOne({
          telegram_id: referrerTelegramId,
        });

        if (referrer) {
          console.log(`✅ Referrer found: ${referrer.username} (ID: ${referrerTelegramId})`);

          // Update new user's referredBy field
          user.referrals.referredBy = referrerTelegramId;
          await user.save();

          // Update referrer's stats and award 100 points
          referrer.referrals.myReferrals =
            referrer.referrals.myReferrals || [];
          referrer.referrals.myReferrals.push(telegramId);
          referrer.referrals.totalReferrals =
            (referrer.referrals.totalReferrals || 0) + 1;
          referrer.referrals.referralPoints =
            (referrer.referrals.referralPoints || 0) + 100;
          await referrer.save();

          console.log(`✅ Referral successful! Awarded 100 points to ${referrer.username}. New points: ${referrer.referrals.referralPoints}`)
        } else {
          console.log(`❌ Referrer not found in database for ID: ${referrerTelegramId}`);
        }
      } else {
        if (!isNewUser) {
          console.log(`User ${telegramId} already exists, skipping referral linking`);
        }
      }

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
            Markup.button.callback(" Join  Group", "join"),
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
          [Markup.button.callback("Referral", "referral"),
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
