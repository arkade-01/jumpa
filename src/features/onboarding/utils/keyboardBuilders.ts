import { Markup } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/types";

/**
 * Build keyboard for private chat context
 * Shows full menu with wallet, profile, groups, and transaction options
 */
export function buildPrivateChatKeyboard(): {
  reply_markup: InlineKeyboardMarkup;
} {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(" View Wallet", "view_wallet"),
      Markup.button.callback(" My Profile", "view_profile"),
    ],
    [
      Markup.button.callback("Withdraw", "withdraw_sol"),
      Markup.button.callback("Referral", "referral")
    ],
    [
      Markup.button.callback(" Help & Commands", "show_help"),
      Markup.button.callback(" About Jumpa", "show_about"),
    ],
    [Markup.button.callback("🔄 Refresh", "back_to_menu")],
  ]);
}

/**
 * Build keyboard for group chat context
 * Shows group-specific actions like deposit, settings, and exit
 */
export function buildGroupChatKeyboard(): {
  reply_markup: InlineKeyboardMarkup;
} {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(" Create Group", "create_group"),
      Markup.button.callback(" Join  Group", "join"),
    ],
    [
      Markup.button.callback("💰 Fund Account", "group_deposit"),
    ],
    [
      Markup.button.callback("⚙️ Group Settings", "group_settings"),
      Markup.button.callback("🚪 Exit Group", "group_exit"),
    ],
    [
      Markup.button.callback("➕ More Actions", "group_more_actions"),
      Markup.button.callback(" Help", "show_help"),
    ],
    [Markup.button.callback("🔄 Refresh", "back_to_menu")],
  ]);
}

/**
 * Build keyboard for wallet setup (when user has no wallets)
 * Same for both private and group chats
 */
export function buildWalletSetupKeyboard(): {
  reply_markup: InlineKeyboardMarkup;
} {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(" Generate Solana Wallet", "generate_wallet"),
      Markup.button.callback(" Import Solana Wallet", "import_wallet"),
    ],
    [
      Markup.button.callback("Generate EVM Wallet", "generate_evm_wallet"),
      Markup.button.callback("Import EVM Wallet", "add_wallet_evm"),
    ],
  ]);
}
