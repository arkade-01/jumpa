import { Context } from "telegraf";
import getUser from "../../services/getUserInfo";
import { AjoCallbackHandlers } from "./AjoCallbackHandlers";

export class StartCallbackHandlers {
  // Handle view wallet callback
  static async handleViewWallet(ctx: Context): Promise<void> {
    try {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!telegramId) {
        await ctx.answerCbQuery("❌ Unable to identify your account.");
        return;
      }

      await ctx.answerCbQuery("🔑 Opening wallet...");

      // Get user info and show wallet
      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      const walletMessage = `
🔑 **Your Solana Wallet**

📍 **Address:** \`${user.wallet_address}\`
💰 **Balance:** ${user.user_balance} SOL
📅 **Last Updated:** ${user.last_updated_balance.toLocaleString()}

⚠️ **Security Note:** Keep your private key secure!
      `;

      // Import WalletCommand keyboard
      const { Markup } = await import("telegraf");
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
      console.error("View wallet error:", error);
      await ctx.answerCbQuery("❌ Failed to open wallet.");
    }
  }

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

      const profileMessage = `
📊 **Your Profile**

👤 **Username:** ${username}
🆔 **Telegram ID:** ${user.telegram_id}
📍 **Wallet Address:** \`${user.wallet_address}\`
💰 **Balance:** ${user.user_balance} SOL
📅 **Member Since:** ${user.created_at.toLocaleString()}
🔄 **Last Active:** ${user.last_seen?.toLocaleString() || "Never"}
🔒 **Status:** ${user.is_active ? "Active" : "Inactive"}
👑 **Role:** ${user.role}

🏠 **Ajo Groups:** 0 (Coming Soon!)
      `;

      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🏠 Back to Main Menu", "back_to_menu")],
      ]);

      await ctx.reply(profileMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("View profile error:", error);
      await ctx.answerCbQuery("❌ Failed to load profile.");
    }
  }

  // Handle create ajo callback
  static async handleCreateAjo(ctx: Context): Promise<void> {
    await AjoCallbackHandlers.handleCreateAjo(ctx);
  }

  // Handle join ajo callback
  static async handleJoinAjo(ctx: Context): Promise<void> {
    await AjoCallbackHandlers.handleJoinAjo(ctx);
  }

  // Handle show help callback
  static async handleShowHelp(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("❓ Help & Commands");

      const helpMessage = `
❓ **Help & Commands**

**Available Commands:**
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/help - Show this help message
/ping - Check if bot is alive
/info - Get bot information

**Coming Soon:**
/create_ajo - Create an Ajo group
/join <group_id> - Join an Ajo group
/vote <poll_id> <yes/no> - Vote on polls
/history - View trading history

**Need Support?**
Contact @your_support_username for help!
      `;

      await ctx.reply(helpMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Show help error:", error);
      await ctx.answerCbQuery("❌ Failed to show help.");
    }
  }

  // Handle show about callback
  static async handleShowAbout(ctx: Context): Promise<void> {
    try {
      await ctx.answerCbQuery("ℹ️ About Jumpa");

      const aboutMessage = `
ℹ️ **About Jumpa Ajo Bot**

**What is Jumpa?**
Jumpa is a Telegram bot that enables collaborative trading through Ajo groups - traditional savings groups reimagined for the digital age.

**Key Features:**
🔑 **Auto-generated Solana wallets** for each user
💰 **Collective fund pooling** with SOL
🗳️ **Democratic voting** on trading decisions
📊 **Transparent profit sharing** based on contributions
🔒 **Secure smart contract integration**

**How It Works:**
1. Create or join an Ajo group
2. Contribute SOL to the group pool
3. Vote on trading proposals
4. Share profits based on your contribution

**Built on Solana** for fast, cheap transactions!

**Version:** 1.0.0 (MVP)
**Status:** In Development
      `;

      await ctx.reply(aboutMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Show about error:", error);
      await ctx.answerCbQuery("❌ Failed to show about.");
    }
  }

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

      const user = await getUser(telegramId, username);

      if (!user) {
        await ctx.reply(
          "❌ User not found. Please use /start to register first."
        );
        return;
      }

      const welcomeMessage = `
👋 Welcome to Jumpa Ajo Bot, ${username}!

🔑 Your Wallet: \`${user.wallet_address}\`
💰 Balance: ${user.user_balance} SOL

🚀 Ready to start collaborative trading!
      `;

      const { Markup } = await import("telegraf");
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔑 View Wallet", "view_wallet"),
          Markup.button.callback("📊 My Profile", "view_profile"),
        ],
        [
          Markup.button.callback("🏠 Create Ajo Group", "create_ajo"),
          Markup.button.callback("👥 Join Ajo Group", "join_ajo"),
        ],
        [
          Markup.button.callback("📊 Ajo Info", "ajo_info"),
        ],
        [
          Markup.button.callback("❓ Help & Commands", "show_help"),
          Markup.button.callback("ℹ️ About Jumpa", "show_about"),
        ],
      ]);

      await ctx.reply(welcomeMessage, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("Back to menu error:", error);
      await ctx.answerCbQuery("❌ Failed to return to main menu.");
    }
  }
}
