import { Markup } from 'telegraf';
import { decryptPrivateKey } from '@shared/utils/encryption';
import { getUserActionState, setUserActionState, clearUserActionState } from '@shared/state/userActionState';
import getUser from '@modules/users/getUserInfo';

export const handleExportPrivateKey = (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    "⚠️ Warning: Exporting your private key can expose your funds to theft if the key is misplaced or seen by others. Proceed with caution.",
    Markup.inlineKeyboard([
      Markup.button.callback("Proceed", "proceed_export"),
      Markup.button.callback("Cancel", "cancel_export"),
    ])
  );
};

export const handleProceedExport = (ctx) => {
  ctx.answerCbQuery();
  ctx.deleteMessage();
  ctx.reply("Enter your withdrawal pin to view your private key.");
  setUserActionState(ctx.from.id, { action: "awaiting_export_pin" });
};

export const handleCancelExport = (ctx) => {
  ctx.answerCbQuery();
  ctx.deleteMessage();
};

export const handlePinForExport = async (ctx) => {
  const pin = Number(ctx.message.text || "");
  const userId = ctx.from.id;

  const userAction = getUserActionState(userId);
  console.log("User  pin:", pin);

  if (userAction?.action === "awaiting_export_pin") {
    try {
      const user = await getUser(ctx.from.id, ctx.from.username);
      if (user && user.bank_details.withdrawalPin === pin) {
        const privateKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
        const message = await ctx.reply(`Your private key is: 
${privateKey}

This message will be deleted in 15 seconds.`);

        setTimeout(() => {
          ctx.telegram.deleteMessage(ctx.chat.id, message.message_id);
          ctx.reply("For your security, the private key has been deleted.");
        }, 15000);

      } else {
        ctx.reply("❌ Incorrect pin. Restart the process again");
      }
    } catch (error) {
      console.error("Error during private key export:", error);
      ctx.reply("An error occurred. Please try again later.");
    } finally {
      clearUserActionState(userId);
    }
  }
};