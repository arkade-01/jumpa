import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import User from "@database/models/user";
import { encodeBase62 } from "@shared/utils/base62";

export class ReferralCommand extends BaseCommand {
  name = "referral";
  description = "View referral stats and get referral link";

  async execute(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await this.sendMessage(
          ctx,
          "❌ Unable to identify your Telegram account."
        );
        return;
      }

      // Fetch user from database
      const user = await User.findOne({ telegram_id: telegramId });

      if (!user) {
        await this.sendMessage(ctx, "❌ User not found. Please use /start first.");
        return;
      }

      // Generate referral code if user doesn't have one
      if (!user.referrals?.referralCode) {
        const referralCode = encodeBase62(telegramId);
        user.referrals = {
          ...user.referrals,
          referralCode,
        };
        await user.save();
      }

      const referralCode = user.referrals.referralCode;
      const totalReferrals = user.referrals?.totalReferrals || 0;
      const referralPoints = user.referrals?.referralPoints || 0;

      // Get bot username from context (fallback to generic if not available)
      const botUsername = ctx.botInfo?.username || "jumpa_bot";
      const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

      const message = `
• Total Referrals: ${totalReferrals}
• Referral Points: ${referralPoints}

*Your Referral Link:*
\`${referralLink}\`

Share your referral link with your friends and earn points for each friend who joins using your link, places a trade or withdraws via P2P!

Tap the link above to copy and share it.`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Referral command error:", error);
      await this.sendMessage(
        ctx,
        "❌ An error occurred while fetching your referral information."
      );
    }
  }
}
