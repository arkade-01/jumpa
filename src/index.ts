import { Telegraf, Context } from "telegraf";
import { CommandManager } from "@bot/commands/CommandManager";
import { config } from "@core/config/config";
import connectToDatabase from "@core/config/database";

// Initialize the bot with token from environment variables
const bot = new Telegraf(config.botToken || "");

// Middleware for logging
bot.use((ctx, next) => {
  const start = Date.now();
  return next().then(() => {
    const ms = Date.now() - start;
    console.log(`Response time: ${ms}ms`);
  });
});

// Initialize command manager
const commandManager = new CommandManager(bot);



// Error handling
bot.catch((err: any, ctx: Context) => {
  console.error("Bot error:", err);
  ctx.reply("Sorry, something went wrong! Please try again later.");
});

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("Shutting down bot...");
  bot.stop("SIGTERM");
});

// Start the bot
async function startBot() {
  await connectToDatabase();
  try {
    if (!config.botToken) {
      throw new Error("BOT_TOKEN environment variable is required");
    }

    console.log("Starting Jumpa Bot...");
    await bot.launch();
    console.log("✅ Bot is running... Press Ctrl+C to stop the bot");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

// Start the bot
startBot();
