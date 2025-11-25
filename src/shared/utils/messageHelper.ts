import { Context } from "telegraf";

/**
 * Send or edit a message based on context type
 *
 * This helper automatically determines whether to edit an existing message
 * (when called from a callback query) or send a new message (when called
 * from a command or regular message).
 *
 * Benefits:
 * - Cleaner chat interface (no message spam)
 * - Better UX (app-like feel)
 * - Fewer API calls to Telegram
 * - Automatic fallback handling
 *
 * @param ctx - Telegraf context
 * @param text - Message text to send/edit
 * @param extra - Extra options (parse_mode, keyboard, etc.)
 *
 * @example
 * // Instead of:
 * await ctx.reply(message, { parse_mode: "Markdown", ...keyboard });
 *
 * // Use:
 * await sendOrEdit(ctx, message, { parse_mode: "Markdown", ...keyboard });
 */
export async function sendOrEdit(
  ctx: Context,
  text: string,
  extra?: any
): Promise<void> {
  // If this is a callback query, try to edit the existing message
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
    } catch (error: any) {
      // Check if the error is because the message content hasn't changed
      const isNotModifiedError =
        error?.message?.includes("message is not modified") ||
        error?.description?.includes("message is not modified");

      if (isNotModifiedError) {
        // Silently ignore - the message is already showing the correct content
        console.log("Message content unchanged, no edit needed");
        return;
      }

      // For other errors (message too old, already deleted, etc.),
      // fall back to sending a new message
      console.log("Edit message failed, falling back to reply:", error.message);
      await ctx.reply(text, extra);
    }
  } else {
    // For commands and regular messages, always send a new message
    await ctx.reply(text, extra);
  }
}
