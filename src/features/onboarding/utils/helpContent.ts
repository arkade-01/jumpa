import { Markup } from "telegraf";

/**
 * Centralized help content for the bot
 * Used by both HelpCommand (/help) and HelpAboutHandlers (callback)
 */
export const HELP_MESSAGE = `<b>🤖 Jumpa Bot Commands:</b>

<b>General Commands:</b>
/start - Start the bot and register
/wallet - View your wallet information
/profile - View your profile details
/help - Show this help message
/ping - Check if bot is alive
/info - Get bot information

<b>Group Commands:</b>
/create_group - Create a group
/join group_id - Join a group
/vote poll_id yes/no - Vote on polls
/history - View trading history

<b>Need Support?</b>
Contact @official_jumpa_bot for help!`;

/**
 * About message content
 */
export const ABOUT_MESSAGE = `ℹ️ <b>About Jumpa Bot</b>

<b>What is Jumpa?</b>
Jumpa is a Telegram bot that enables collaborative trading through groups - traditional savings groups reimagined for the digital age.

<b>Key Features:</b>
  <b>Auto-generated wallets</b> for each user
  <b>Collective fund pooling</b> with SOL or USDT
  <b>Democratic voting</b> on trading decisions
  <b>Transparent profit sharing</b> based on contributions
  <b>Secure smart contract integration</b>

<b>How It Works:</b>
  1. Create or join an group
  2. Contribute SOL or USDT to the group pool
  3. Vote on trading proposals
  4. Share profits based on your contribution
`;

/**
 * Get help message with optional keyboard
 * @param includeKeyboard - Whether to include the "Back to Main Menu" button
 */
export function getHelpContent(includeKeyboard: boolean = false) {
  if (includeKeyboard) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")]
    ]);

    return {
      message: HELP_MESSAGE,
      options: { parse_mode: "HTML" as const, ...keyboard }
    };
  }

  return {
    message: HELP_MESSAGE,
    options: { parse_mode: "HTML" as const }
  };
}

/**
 * Get about message with optional keyboard
 * @param includeKeyboard - Whether to include the "Back to Main Menu" button
 */
export function getAboutContent(includeKeyboard: boolean = false) {
  if (includeKeyboard) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Back to Main Menu", "back_to_menu")]
    ]);

    return {
      message: ABOUT_MESSAGE,
      options: { parse_mode: "HTML" as const, ...keyboard }
    };
  }

  return {
    message: ABOUT_MESSAGE,
    options: { parse_mode: "HTML" as const }
  };
}
