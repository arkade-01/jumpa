import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Show help message with available commands";

  async execute(ctx: Context): Promise<void> {
    const helpText = `
🤖 *Jumpa Bot Commands:*

/start - Start the bot
/help - Show this help message
/ping - Check if bot is alive
/info - Get bot information

*Features:*
• Fast and responsive
• Built with TypeScript
• Ready for customization
    `;
    await this.sendMessage(ctx, helpText, "Markdown");
  }
}
