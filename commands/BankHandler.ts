import { setBankUpdateState, getBankUpdateState, clearBankUpdateState } from '../state/bankState';
import getUser from "../services/getUserInfo";
import { Context, Markup } from "telegraf";

export class BankHandler {
  static async getBankAccount(ctx: Context): Promise<void> {
    await ctx.answerCbQuery("🏠 Getting Bank Account");

    try {

      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Check if user is registered and retrieve bank details
      try {
        const usrInfo = await getUser(userId, username);
        if (!usrInfo) {
          await ctx.reply("❌ User not found. Please use /start to register first.");
          return;
        } else if (!usrInfo.bank_details.account_name || !usrInfo.bank_details.account_number || !usrInfo.bank_details.bank_name) {

          const createAjoMessage = `
          ❌ No bank account found. Please set up your bank account below. 


                `;

          // Create inline keyboard for quick actions
          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback("🔑 Add Bank Name", "update_bank_name"),
            ],
            [
              Markup.button.callback("ℹ️ Add Account Name", "update_account_name"),
              Markup.button.callback("❓Add Account Number", "update_account_number"),
            ],
          ]);
          await ctx.reply(createAjoMessage, {
            parse_mode: "Markdown", ...keyboard,
          });
          return;
        }

        const createAjoMessage = `
 <b>🏠 YOUR BANK DETAILS</b>
        

    <b>Bank Name:</b> ${usrInfo.bank_details.bank_name}
  
    <b>Account Name:</b> ${(usrInfo.bank_details.account_name).toUpperCase()}
  
    <b>Account Number:</b> ${usrInfo.bank_details.account_number}
        
              `;
        const sentMessage = await ctx.reply(createAjoMessage, {
          parse_mode: "HTML"
        });

        setTimeout(() => {
          ctx.deleteMessage(sentMessage.message_id);
        }, 30000); //delete after 30 seconds

      } catch (error) {
        console.error("Error retrieving user info:", error);
        await ctx.reply("❌ An error occurred while retrieving your bank account.");
        return;
      }

    } catch (error) {
      console.error("Create ajo error:", error);
      await ctx.answerCbQuery("❌ Failed to open create ajo.");
    }

  }

  static async updateBankName(ctx: Context): Promise<void> {
    // Top 25 widely used Nigerian banks
    const banks = [
      { Name: "Opay", Code: "100004" },
      { Name: "Guaranty Trust Bank", Code: "058" },
      { Name: "Access Bank", Code: "044" },
      { Name: "First Bank PLC", Code: "011" },
      { Name: "Zenith Bank PLC", Code: "057" },
      { Name: "United Bank for Africa", Code: "033" },
      { Name: "Union Bank PLC", Code: "032" },
      { Name: "EcoBank PLC", Code: "050" },
      { Name: "Fidelity Bank", Code: "070" },
      { Name: "Stanbic IBTC Bank", Code: "221" },
      { Name: "First City Monument Bank (FCMB)", Code: "214" },
      { Name: "Wema Bank PLC", Code: "035" },
      { Name: "Polaris Bank", Code: "076" },
      { Name: "Keystone Bank", Code: "082" },
      { Name: "Sterling Bank PLC", Code: "232" },
      { Name: "ProvidusBank PLC", Code: "101" },
      { Name: "Kuda", Code: "090267" },
      { Name: "Moniepoint Microfinance Bank", Code: "090405" },
      { Name: "Paga", Code: "327" },
      { Name: "Unity Bank PLC", Code: "215" },
      { Name: "Jaiz Bank", Code: "301" },
      { Name: "Titan Trust Bank", Code: "000025" },
      { Name: "AccessMobile", Code: "100013" },
      { Name: "GTBank (Guaranty) Mobile", Code: "100009" },
      { Name: "FCMB Easy Account", Code: "100031" },
    ];

    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // If this was triggered by a callback query, inspect callback data
      const cbData = (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;

      if (cbData && typeof cbData === "string") {
        if (cbData === 'update_bank_name') {
          setBankUpdateState(userId, 'awaiting_bank_name');
          const createAjoMessage = `
            Choose from a list of the supported banks below.

<b>Supported Banks:</b>

${banks
              .map((bank, index) => `<b>${(index + 1).toString().padStart(2, "0")}. ${bank.Name}</b>`)
              .join("\n")}
Reply with the bank id to select it. For eg: reply with 0️⃣1️⃣ to select Opay.
                  `;
          await ctx.reply(createAjoMessage, { parse_mode: "HTML" });
          return;
        }
      }
    } catch (error) {
      console.error("Create ajo error:", error);
      await ctx.answerCbQuery("❌ Failed to open create ajo.");
    }
  }

  static async handleFinalConfirmation(ctx: Context): Promise<void> {
    const cbData = (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;
    if (!cbData || typeof cbData !== "string") return;

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Unable to identify user.");
      return;
    }

    if (cbData === 'final_confirmation:confirm') {
      const state = getBankUpdateState(userId);
      if (state && state.step === 'awaiting_final_confirmation') {
        const { bankName, bankCode, accountName, accountNumber } = state.data;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
        const usr = await getUser(userId, username);
        if (usr) {
          usr.bank_details.bank_name = bankName;
          usr.bank_details.bank_code = bankCode;
          usr.bank_details.account_name = accountName;
          usr.bank_details.account_number = accountNumber;
          await usr.save();
          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback("🔙 Back to Main Menu", "back_to_menu"),
              Markup.button.callback("📊 View Profile", "view_profile"),
            ],
          ]);
          await ctx.reply("✅ Bank details updated successfully!", keyboard);
        } else {
          await ctx.reply("❌ User not found.");
        }
        clearBankUpdateState(userId);
      }
      return;
    }

    if (cbData === 'final_confirmation:cancel') {
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("Operation cancelled.");
      clearBankUpdateState(userId);
      return;
    }
  }


  static async handleBankNameConfirmation(ctx: Context): Promise<void> {
    const banks = [
      { Name: "Opay", Code: "100004" },
      { Name: "Guaranty Trust Bank", Code: "058" },
      { Name: "Access Bank", Code: "044" },
      { Name: "First Bank PLC", Code: "011" },
      { Name: "Zenith Bank PLC", Code: "057" },
      { Name: "United Bank for Africa", Code: "033" },
      { Name: "Union Bank PLC", Code: "032" },
      { Name: "EcoBank PLC", Code: "050" },
      { Name: "Fidelity Bank", Code: "070" },
      { Name: "Stanbic IBTC Bank", Code: "221" },
      { Name: "First City Monument Bank (FCMB)", Code: "214" },
      { Name: "Wema Bank PLC", Code: "035" },
      { Name: "Polaris Bank", Code: "076" },
      { Name: "Keystone Bank", Code: "082" },
      { Name: "Sterling Bank PLC", Code: "232" },
      { Name: "ProvidusBank PLC", Code: "101" },
      { Name: "Kuda", Code: "090267" },
      { Name: "Moniepoint Microfinance Bank", Code: "090405" },
      { Name: "Paga", Code: "327" },
      { Name: "Unity Bank PLC", Code: "215" },
      { Name: "Jaiz Bank", Code: "301" },
      { Name: "Titan Trust Bank", Code: "000025" },
      { Name: "AccessMobile", Code: "100013" },
      { Name: "GTBank (Guaranty) Mobile", Code: "100009" },
      { Name: "FCMB Easy Account", Code: "100031" },
    ];

    const cbData = (ctx.callbackQuery && (ctx.callbackQuery as any).data) || null;
    if (!cbData || typeof cbData !== "string") return;

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Unable to identify user.");
      return;
    }

    if (cbData.startsWith("update_bank_name:confirm:")) {
      await ctx.answerCbQuery("Saving...");
      const parts = cbData.split(":");
      const idx = parseInt(parts[2], 10);
      const bank = banks[idx];
      if (!bank) {
        await ctx.reply("❌ Invalid selection.");
        return;
      }

      setBankUpdateState(userId, 'awaiting_account_name', { bankName: bank.Name, bankCode: bank.Code });
      await ctx.reply("Please enter your account name.");
      return;
    }

    if (cbData === "update_bank_name:cancel") {
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("Operation cancelled.");
      clearBankUpdateState(userId);
      return;
    }
  }


  static async handleBankUpdate(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const message = (ctx.message as any)?.text;

    if (!userId || !message) {
      return;
    }

    const state = getBankUpdateState(userId);
    if (!state) {
      return;
    }

    const { step, data } = state;

    switch (step) {
      case 'awaiting_bank_name':
        // This is handled by handleBankNameSelection
        break;

      case 'awaiting_account_name':
        setBankUpdateState(userId, 'awaiting_account_number', { accountName: message });
        await ctx.reply("Please enter your account number.");
        break;

      case 'awaiting_account_number':
        const { bankName, accountName } = data;
        const confirmMessage = `
        Please confirm your bank details:
        
        **Bank Name:** ${bankName}
        **Account Name:** ${accountName}
        **Account Number:** ${message}
        
        Is this correct?
        `;

        const confirmKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Accept", 'final_confirmation:confirm'),
            Markup.button.callback("❌ Decline", 'final_confirmation:cancel'),
          ],
        ]);

        setBankUpdateState(userId, 'awaiting_final_confirmation', { accountNumber: message });
        await ctx.reply(confirmMessage, { parse_mode: "Markdown", ...confirmKeyboard });
        break;
    }
  }

  static async handleBankNameSelection(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }
    const state = getBankUpdateState(userId);
    if (!state || state.step !== 'awaiting_bank_name') {
      return;
    }

    // Top 25 widely used Nigerian banks
    const banks = [
      { Name: "Opay", Code: "100004" },
      { Name: "Guaranty Trust Bank", Code: "058" },
      { Name: "Access Bank", Code: "044" },
      { Name: "First Bank PLC", Code: "011" },
      { Name: "Zenith Bank PLC", Code: "057" },
      { Name: "United Bank for Africa", Code: "033" },
      { Name: "Union Bank PLC", Code: "032" },
      { Name: "EcoBank PLC", Code: "050" },
      { Name: "Fidelity Bank", Code: "070" },
      { Name: "Stanbic IBTC Bank", Code: "221" },
      { Name: "First City Monument Bank (FCMB)", Code: "214" },
      { Name: "Wema Bank PLC", Code: "035" },
      { Name: "Polaris Bank", Code: "076" },
      { Name: "Keystone Bank", Code: "082" },
      { Name: "Sterling Bank PLC", Code: "232" },
      { Name: "ProvidusBank PLC", Code: "101" },
      { Name: "Kuda", Code: "090267" },
      { Name: "Moniepoint Microfinance Bank", Code: "090405" },
      { Name: "Paga", Code: "327" },
      { Name: "Unity Bank PLC", Code: "215" },
      { Name: "Jaiz Bank", Code: "301" },
      { Name: "Titan Trust Bank", Code: "000025" },
      { Name: "AccessMobile", Code: "100013" },
      { Name: "GTBank (Guaranty) Mobile", Code: "100009" },
      { Name: "FCMB Easy Account", Code: "100031" },
    ];

    const text = (ctx.message && (ctx.message as any).text) || "";
    if (text && typeof text === "string") {
      const trimmed = text.trim();
      const numeric = parseInt(trimmed, 10);
      if (!isNaN(numeric)) {
        const idx = numeric - 1; // convert 1-based to 0-based
        if (idx < 0 || idx >= banks.length) {
          await ctx.reply(`❌ Please enter a number between 01 and ${banks.length.toString().padStart(2, "0")}.`);
          return;
        }

        const bank = banks[idx];
        const confirmKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Accept", `update_bank_name:confirm:${idx}`),
            Markup.button.callback("❌ Decline", `update_bank_name:cancel`),
          ],
        ]);

        await ctx.reply(`You selected: <b>${bank.Name}</b> (Code: <code>${bank.Code}</code>)\n\nDo you want to save this as your bank?`, { parse_mode: "HTML", ...confirmKeyboard });
        return;
      }
    }
  }
}