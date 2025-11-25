import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { getHelpContent } from "@modules/onboarding/utils/helpContent";

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Show help message with available commands";

  async execute(ctx: Context): Promise<void> {
    const { message, options } = getHelpContent(false);
    await ctx.reply(message, options);
  }
}
