import { Markup } from 'telegraf';
import { decryptPrivateKey } from '@shared/utils/encryption';
import { getUserActionState, setUserActionState, clearUserActionState } from '@shared/state/userActionState';
import getUser from '@modules/users/getUserInfo';

export const handleExportPrivateKey = async (ctx) => {
  ctx.answerCbQuery();

  try {
    const user = await getUser(ctx.from.id, ctx.from.username);

    if (!user) {
      ctx.reply("❌ User not found. Please try again.");
      return;
    }

    const buttons = [];

    // Add Solana wallet export buttons
    if (user.solanaWallets && user.solanaWallets.length > 0) {
      user.solanaWallets.forEach((wallet, index) => {
        const label = index === 0
          ? `🔑 Export SOL Wallet ${index + 1} (Default)`
          : `🔑 Export SOL Wallet ${index + 1}`;
        buttons.push([Markup.button.callback(label, `select_export_sol:${index}`)]);
      });
    }

    // Add EVM wallet export buttons
    if (user.evmWallets && user.evmWallets.length > 0) {
      user.evmWallets.forEach((wallet, index) => {
        const label = index === 0
          ? `🔑 Export EVM Wallet ${index + 1} (Default)`
          : `🔑 Export EVM Wallet ${index + 1}`;
        buttons.push([Markup.button.callback(label, `select_export_evm:${index}`)]);
      });
    }

    // Add cancel button
    buttons.push([Markup.button.callback("❌ Cancel", "cancel_export")]);

    if (buttons.length === 1) {
      ctx.reply("❌ No wallets found to export.");
      return;
    }

    ctx.reply(
      "🔐 *Select a wallet to export*\n\n⚠️ *Warning:* Exporting your private key can expose your funds to theft if the key is misplaced or seen by others.",
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  } catch (error) {
    console.error("Error fetching wallets for export:", error);
    ctx.reply("An error occurred. Please try again later.");
  }
};

export const handleSelectWalletForExport = (ctx) => {
  console.log("=== handleSelectWalletForExport CALLED ===");
  console.log("Full context:", ctx.callbackQuery);
  ctx.answerCbQuery();

  // Extract wallet type and index from callback data
  // Format: "select_export_sol:0" or "select_export_evm:1"
  const callbackData = ctx.callbackQuery.data;
  console.log("Callback data:", callbackData);

  const parts = callbackData.split(':');
  console.log("Split parts:", parts);

  // Extract wallet type from the first part (e.g., "select_export_sol" -> "sol")
  const walletType = parts[0].replace('select_export_', ''); // 'sol' or 'evm'
  const walletIndex = parseInt(parts[1], 10);

  console.log("Wallet type:", walletType, "Wallet index:", walletIndex);

  ctx.deleteMessage();
  ctx.reply(
    "⚠️ *Warning:* You are about to export your private key. This is a sensitive operation.\n\n🔒 Enter your withdrawal PIN to continue.",
    { parse_mode: 'Markdown' }
  );

  setUserActionState(ctx.from.id, {
    action: "awaiting_export_pin",
    walletType: walletType as 'sol' | 'evm',
    walletIndex: walletIndex
  });
};

export const handleCancelExport = (ctx) => {
  ctx.answerCbQuery("Backup cancelled");
  ctx.deleteMessage();
};

export const handlePinForExport = async (ctx) => {
  const pin = Number(ctx.message.text || "");
  const userId = ctx.from.id;

  const userAction = getUserActionState(userId);
  console.log("User action state:", userAction);

  if (userAction?.action === "awaiting_export_pin") {
    try {
      const user = await getUser(ctx.from.id, ctx.from.username);

      if (!user) {
        ctx.reply("❌ User not found. Please try again.");
        clearUserActionState(userId);
        return;
      }

      if (user.bank_details.withdrawalPin !== pin) {
        ctx.reply("❌ Incorrect PIN. Export cancelled for security. Please restart the process.");
        clearUserActionState(userId);
        return;
      }

      // PIN is correct, proceed with export
      const { walletType, walletIndex } = userAction;

      console.log("Exporting wallet - Type:", walletType, "Index:", walletIndex);
      console.log("User has", user.solanaWallets?.length || 0, "Solana wallets");
      console.log("User has", user.evmWallets?.length || 0, "EVM wallets");

      // Validate that we have the required data
      if (!walletType || walletIndex === undefined) {
        ctx.reply("❌ Wallet selection data missing. Please restart the export process.");
        clearUserActionState(userId);
        return;
      }

      let wallet;
      let walletLabel;

      if (walletType === 'sol') {
        if (!user.solanaWallets || walletIndex >= user.solanaWallets.length) {
          console.log("Solana wallet not found - Index:", walletIndex, "Array length:", user.solanaWallets?.length);
          ctx.reply("❌ Solana wallet not found. Please try again.");
          clearUserActionState(userId);
          return;
        }
        wallet = user.solanaWallets[walletIndex];
        walletLabel = `SOL Wallet ${walletIndex + 1}`;
      } else if (walletType === 'evm') {
        if (!user.evmWallets || walletIndex >= user.evmWallets.length) {
          console.log("EVM wallet not found - Index:", walletIndex, "Array length:", user.evmWallets?.length);
          ctx.reply("❌ EVM wallet not found. Please try again.");
          clearUserActionState(userId);
          return;
        }
        wallet = user.evmWallets[walletIndex];
        walletLabel = `EVM Wallet ${walletIndex + 1}`;
      } else {
        ctx.reply("❌ Invalid wallet type. Please try again.");
        clearUserActionState(userId);
        return;
      }

      if (!wallet || !wallet.encryptedPrivateKey) {
        ctx.reply("❌ Wallet data is incomplete. Please try again.");
        clearUserActionState(userId);
        return;
      }

      const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey);

      const message = await ctx.reply(
        `🔑 *${walletLabel} Private Key*\n\n` +
        `\`${privateKey}\`\n\n` +
        `📍 Address: \`${wallet.address}\`\n\n` +
        `⏱️ *This message will be deleted in 15 seconds.*`,
        { parse_mode: 'Markdown' }
      );

      // Delete the user's PIN message for security
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch (error) {
        console.error("Could not delete PIN message:", error);
      }

      // Auto-delete private key message after 15 seconds
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, message.message_id);
        } catch (error) {
          console.error("Could not delete private key message:", error);
        }
      }, 15000);

    } catch (error) {
      console.error("Error during private key export:", error);
      ctx.reply("❌ An error occurred. Please try again later.");
    } finally {
      clearUserActionState(userId);
    }
  }
};