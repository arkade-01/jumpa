import { Context } from "telegraf";

/**
 * Safely delete a message after a specified delay
 * @param ctx Telegram context
 * @param messageId ID of the message to delete
 * @param delay Delay in milliseconds before deletion (default 30000ms)
 */
export async function safeDeleteMessage(ctx: Context, messageId: number, delay: number = 30000): Promise<void> {
  // Only schedule deletion if we have a valid message ID
  if (!messageId) {
    console.log('No message ID provided for deletion');
    return;
  }

  // Schedule the deletion
  setTimeout(async () => {
    try {
      // Check if the context is still valid
      if (ctx.telegram) {
        await ctx.telegram.deleteMessage(ctx.chat?.id as number, messageId);
      }
    } catch (error: any) {
      // Ignore specific Telegram errors that are expected
      if (error.description?.includes('message to delete not found')) {
        // Message already deleted, ignore
        return;
      }
      if (error.description?.includes('message can\'t be deleted')) {
        // Message cannot be deleted, ignore
        return;
      }
      // Log other errors for debugging
      console.log(`Failed to delete message ${messageId}:`, error.message);
    }
  }, delay);
}