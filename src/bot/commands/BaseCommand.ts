import { Context } from "telegraf";

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;

  abstract execute(ctx: Context): Promise<void> | void;

  // Optional method for command validation
  protected validate(ctx: Context): boolean {
    return true;
  }

  // Helper method to send formatted messages
  protected async sendMessage(
    ctx: Context,
    text: string,
    parseMode?: string
  ): Promise<void> {
    await ctx.reply(text, parseMode ? { parse_mode: parseMode as any } : {});
  }
}
