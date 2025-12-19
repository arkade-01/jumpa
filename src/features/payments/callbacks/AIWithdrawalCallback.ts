import { Context, Markup } from "telegraf";
import { detectWithdrawalIntent } from "./ai";
import { validateAccountNumber } from "./validateAccountNumber";
import { banks } from "./bankCodes";
import { convertNGNToCrypto, getCurrenciesForChain } from "@features/payments/utils/convertNGNToCrypto";
import { setAIWithdrawalState, getAIWithdrawalState, clearAIWithdrawalState, updateAIWithdrawalState } from "@shared/state/aiWithdrawalState";
import getUser from "@features/users/getUserInfo";
import { config } from "@core/config/environment";
import Withdrawal from "@core/database/models/withdrawal";
import { executeSolTransfer, executeUSDCTransfer, executeUSDTTransfer } from "@features/payments/utils/solWithdrawTx";
import { executeETHTransfer, executeUSDCTransferEVM, executeUSDTTransferEVM } from "@features/payments/utils/evmWithdrawTx";
import { generateTransactionReceipt } from "@shared/utils/receiptGenerator";
import { findYaraBankCode } from "@features/payments/utils/yaraBankCodes";

/**
 * Callback Handler for detecting withdrawal intents from natural language
 * Uses AI to parse user messages like "send 2k to 8058509303 GT bank using USDT on solana"
 */
export class AICallbackHandler {
  /**
   * Handle potential withdrawal request from user
   * Supports multi-chain withdrawals with follow-up questions for missing details
   * @param ctx - Telegraf context
   */
  static async handleAIQuery(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !("text" in ctx.message)) {
        return;
      }

      const userMessage = ctx.message.text;
      const userId = ctx.from?.id;

      if (!userId) {
        return;
      }

      console.log(`[AI Withdrawal] Analyzing message from user ${userId}: ${userMessage}`);

      await ctx.sendChatAction("typing");

      const withdrawalData = await detectWithdrawalIntent(userMessage);

      // If no withdrawal intent detected or AI failed, silently ignore
      if (!withdrawalData || !withdrawalData.isWithdrawal) {
        console.log("[AI Withdrawal] No withdrawal intent detected, ignoring message");
        return;
      }

      console.log("[AI Withdrawal] Withdrawal intent detected:", withdrawalData);

      // Handle crypto-to-crypto transfers (future feature - skip for now)
      if (withdrawalData.cryptoAddress) {
        console.log("[AI Withdrawal] Crypto-to-crypto transfer detected - not yet supported");
        await ctx.reply(
          "🔄 Crypto-to-crypto transfers are coming soon!\n\n" +
          "For now, you can only withdraw to Nigerian bank accounts."
        );
        return;
      }

      // Validate we have recipient (account number)
      if (!withdrawalData.recipient) {
        console.log("[AI Withdrawal] Account number not provided");
        return;
      }

      // Check if bank name is specified
      if (!withdrawalData.bankName) {
        console.log("[AI Withdrawal] Bank name not specified, asking user");

        // Store state and ask for bank name
        setAIWithdrawalState(userId, 'awaiting_bank_name' as any, {
          amount: withdrawalData.amount!,
          recipient: withdrawalData.recipient,
          chain: withdrawalData.chain as any,
          currency: withdrawalData.currency as any
        });

        await ctx.reply(
          `💰 Withdrawal Request\n\n` +
          `Amount: *₦${withdrawalData.amount?.toLocaleString()}*\n` +
          `Account: ${withdrawalData.recipient}\n\n` +
          `Please specify the bank name (e.g., "Access Bank", "GT Bank", "Zenith Bank"):`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if chain is specified
      if (!withdrawalData.chain) {
        console.log("[AI Withdrawal] Chain not specified, asking user");

        // Store state and ask for chain
        setAIWithdrawalState(userId, 'awaiting_chain', {
          amount: withdrawalData.amount!,
          recipient: withdrawalData.recipient,
          bankName: withdrawalData.bankName,
          currency: withdrawalData.currency as any
        });

        await ctx.reply(
          `💰 Withdrawal Request\n\n` +
          `Amount: *₦${withdrawalData.amount?.toLocaleString()}*\n` +
          `To: ${withdrawalData.bankName} - ${withdrawalData.recipient}\n\n` +
          `Which blockchain would you like to use?`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback("🟣 Solana", "ai_withdraw_chain:SOLANA"),
                Markup.button.callback("🔵 Base", "ai_withdraw_chain:BASE"),
              ],
              [
                Markup.button.callback("🟢 Celo", "ai_withdraw_chain:CELO"),
                Markup.button.callback("❌ Cancel", "delete_message"),
              ]
            ])
          }
        );
        return;
      }

      // Check if currency is specified
      if (!withdrawalData.currency) {
        console.log("[AI Withdrawal] Currency not specified, asking user");

        // Store state and ask for currency
        setAIWithdrawalState(userId, 'awaiting_currency', {
          amount: withdrawalData.amount!,
          recipient: withdrawalData.recipient,
          bankName: withdrawalData.bankName,
          chain: withdrawalData.chain as any
        });

        const currencies = getCurrenciesForChain(withdrawalData.chain as any);
        const currencyButtons = currencies.map(c =>
          Markup.button.callback(c, `ai_withdraw_currency:${c}`)
        );

        await ctx.reply(
          `💰 Withdrawal Request\n\n` +
          `Amount: *₦${withdrawalData.amount?.toLocaleString()}*\n` +
          `Chain: *${withdrawalData.chain}*\n` +
          `To: ${withdrawalData.bankName} - ${withdrawalData.recipient}\n\n` +
          `Which currency on ${withdrawalData.chain}?`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              currencyButtons,
              [Markup.button.callback("❌ Cancel", "delete_message")]
            ])
          }
        );
        return;
      }

      // All details present - proceed with validation and confirmation
      await AICallbackHandler.processWithdrawalRequest(ctx, {
        amount: withdrawalData.amount!,
        recipient: withdrawalData.recipient,
        bankName: withdrawalData.bankName,
        chain: withdrawalData.chain as 'SOLANA' | 'BASE' | 'CELO',
        currency: withdrawalData.currency as 'SOL' | 'USDC' | 'USDT' | 'ETH'
      });

    } catch (error: any) {
      console.error("[AI Withdrawal] Error in handleAIQuery:", error);
      // Silently fail - don't show error to user for non-withdrawal messages
    }
  }

  /**
   * Handle chain selection from follow-up question
   */
  static async handleChainSelection(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const callbackData = (ctx.callbackQuery as any).data;
    const chain = callbackData.split(":")[1] as 'SOLANA' | 'BASE' | 'CELO';

    console.log(`[AI Withdrawal] User ${userId} selected chain: ${chain}`);

    const state = getAIWithdrawalState(userId);
    if (!state || state.step !== 'awaiting_chain') {
      await ctx.answerCbQuery("❌ Session expired. Please try again.");
      return;
    }

    await ctx.answerCbQuery();

    // Update state with chain
    updateAIWithdrawalState(userId, { chain });

    // Check if we still need currency
    if (!state.data.currency) {
      setAIWithdrawalState(userId, 'awaiting_currency', { ...state.data, chain });

      const currencies = getCurrenciesForChain(chain);
      const currencyButtons = currencies.map(c =>
        Markup.button.callback(c, `ai_withdraw_currency:${c}`)
      );

      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore if can't delete
      }

      await ctx.reply(
        `💰 Withdrawal Request\n\n` +
        `Amount: *₦${state.data.amount.toLocaleString()}*\n` +
        `Chain: *${chain}*\n` +
        `To: ${state.data.bankName} - ${state.data.recipient}\n\n` +
        `Which currency on ${chain}?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            currencyButtons,
            [Markup.button.callback("❌ Cancel", "delete_message")]
          ])
        }
      );
    } else {
      // Proceed to validation and confirmation
      await AICallbackHandler.processWithdrawalRequest(ctx, {
        amount: state.data.amount,
        recipient: state.data.recipient,
        bankName: state.data.bankName!,  // Assert it's present
        chain,
        currency: state.data.currency!
      });
    }
  }

  /**
   * Handle currency selection from follow-up question
   */
  static async handleCurrencySelection(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const callbackData = (ctx.callbackQuery as any).data;
    const currency = callbackData.split(":")[1] as 'SOL' | 'USDC' | 'USDT' | 'ETH';

    console.log(`[AI Withdrawal] User ${userId} selected currency: ${currency}`);

    const state = getAIWithdrawalState(userId);
    if (!state || state.step !== 'awaiting_currency') {
      await ctx.answerCbQuery("❌ Session expired. Please try again.");
      return;
    }

    await ctx.answerCbQuery();

    // Proceed to validation and confirmation
    await AICallbackHandler.processWithdrawalRequest(ctx, {
      ...state.data,
      bankName: state.data.bankName!,  // Assert it's present
      currency,
      chain: state.data.chain!
    });
  }

  /**
   * Handle bank name text input from follow-up question
   */
  static async handleBankNameInput(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const message = (ctx.message as any)?.text;

    if (!userId || !message) {
      return;
    }

    const state = getAIWithdrawalState(userId);
    if (!state || state.step !== 'awaiting_bank_name') {
      return;
    }

    const bankName = message.trim();

    console.log(`[AI Withdrawal] User ${userId} provided bank name: ${bankName}`);

    // Update state with bank name
    updateAIWithdrawalState(userId, { bankName });

    // Check if we still need chain
    if (!state.data.chain) {
      setAIWithdrawalState(userId, 'awaiting_chain', { ...state.data, bankName });

      await ctx.reply(
        `💰 Withdrawal Request\n\n` +
        `Amount: *₦${state.data.amount.toLocaleString()}*\n` +
        `To: ${bankName} - ${state.data.recipient}\n\n` +
        `Which blockchain would you like to use?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("🟣 Solana", "ai_withdraw_chain:SOLANA"),
              Markup.button.callback("🔵 Base", "ai_withdraw_chain:BASE"),
            ],
            [
              Markup.button.callback("🟢 Celo", "ai_withdraw_chain:CELO"),
              Markup.button.callback("❌ Cancel", "delete_message"),
            ]
          ])
        }
      );
    } else if (!state.data.currency) {
      // Need currency
      setAIWithdrawalState(userId, 'awaiting_currency', { ...state.data, bankName });

      const currencies = getCurrenciesForChain(state.data.chain);
      const currencyButtons = currencies.map(c =>
        Markup.button.callback(c, `ai_withdraw_currency:${c}`)
      );

      await ctx.reply(
        `💰 Withdrawal Request\n\n` +
        `Amount: *₦${state.data.amount.toLocaleString()}*\n` +
        `Chain: *${state.data.chain}*\n` +
        `To: ${bankName} - ${state.data.recipient}\n\n` +
        `Which currency on ${state.data.chain}?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            currencyButtons,
            [Markup.button.callback("❌ Cancel", "delete_message")]
          ])
        }
      );
    } else {
      // Have everything, proceed to validation
      await AICallbackHandler.processWithdrawalRequest(ctx, {
        ...state.data,
        bankName,
        chain: state.data.chain,
        currency: state.data.currency
      });
    }
  }

  /**
   * Process withdrawal request with all details present
   * Validates account and shows confirmation
   */
  private static async processWithdrawalRequest(
    ctx: Context,
    data: {
      amount: number;
      recipient: string;
      bankName: string;  // Required here
      chain: 'SOLANA' | 'BASE' | 'CELO';
      currency: 'SOL' | 'USDC' | 'USDT' | 'ETH';
    }
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log("[AI Withdrawal] Processing withdrawal request:", data);

    // Find bank code
    const bankCode = AICallbackHandler.findBankCode(data.bankName);
    if (!bankCode) {
      console.log(`[AI Withdrawal] Bank code not found for: ${data.bankName}`);
      clearAIWithdrawalState(userId);
      await ctx.reply(
        `❌ Sorry, I couldn't find the bank code for "${data.bankName}".\n\n` +
        `Please use the full bank name (e.g., "Access Bank", "GT Bank", "Zenith Bank").`
      );
      return;
    }

    console.log(`[AI Withdrawal] Found bank code: ${bankCode} for ${data.bankName}`);

    // Validate account number with Paystack
    const validationResult = await validateAccountNumber(data.recipient, bankCode);

    if (!validationResult || !validationResult.status) {
      console.log("[AI Withdrawal] Account validation failed:", validationResult);
      clearAIWithdrawalState(userId);
      await ctx.reply(
        `❌ Unable to validate account number *${data.recipient}* for *${data.bankName}*.\n\n` +
        `Please double check the account number and bank name, then try again.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    console.log("[AI Withdrawal] Account validated successfully:", validationResult.data);

    // Calculate crypto amount from NGN
    const cryptoAmount = await convertNGNToCrypto(data.amount, data.currency, data.chain);

    // Store complete data in state for PIN entry
    setAIWithdrawalState(userId, 'awaiting_pin', {
      ...data,
      bankCode,
      accountName: validationResult.data.account_name,
      cryptoAmount,
      pinAttempts: 0  // Initialize PIN attempts counter
    });

    // Generate confirmation message and ask for PIN directly
    const accountName = validationResult.data.account_name;
    const confirmationMessage =
      `🔐 *Please enter your 4-digit withdrawal PIN to confirm sending  ₦${data.amount.toLocaleString()} using ${data.currency} on ${data.chain} to *\n\n` +
      `👤 Name: *${accountName}*\n` +
      `📱 Account: \`${data.recipient}\`\n` +
      `🏦 Bank: *${data.bankName}*\n\n`;

    // Don't delete the original message - let user see their request
    await ctx.reply(confirmationMessage, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel", "ai_withdraw_cancel")]
      ])
    });
  }

  /**
   * Handle withdrawal cancellation
   */
  static async handleWithdrawalCancellation(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    clearAIWithdrawalState(userId);
    await ctx.answerCbQuery("❌ Withdrawal cancelled");

    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    await ctx.reply("Withdrawal cancelled.");
  }

  /**
   * Handle PIN input and execute withdrawal
   */
  static async handlePINInput(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
    const message = (ctx.message as any)?.text;

    if (!userId || !message) {
      return;
    }

    const state = getAIWithdrawalState(userId);
    if (!state || state.step !== 'awaiting_pin') {
      return;
    }

    const enteredPin = message.trim();

    // Validate PIN format
    if (!/^\d{4}$/.test(enteredPin)) {
      await ctx.reply("❌ Invalid PIN format. Please enter a 4-digit numeric PIN.");
      return;
    }

    const user = await getUser(userId, username);
    if (!user) {
      await ctx.reply("❌ User does not exist.");
      clearAIWithdrawalState(userId);
      return;
    }

    // Verify PIN
    if (user.bank_details.withdrawalPin !== parseInt(enteredPin, 10)) {
      // Delete the incorrect PIN message for security
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore
      }

      // Increment PIN attempts
      const currentAttempts = (state.data.pinAttempts || 0) + 1;

      if (currentAttempts >= 2) {
        // Clear state after 2 failed attempts
        clearAIWithdrawalState(userId);
        await ctx.reply(
          "❌ *Withdrawal Cancelled*\n\n" +
          "You have entered an incorrect PIN twice. For security reasons, this withdrawal has been cancelled.\n\n" +
          "Please start a new withdrawal request.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Update state with incremented attempts
      updateAIWithdrawalState(userId, { pinAttempts: currentAttempts });

      await ctx.reply(
        `❌ Incorrect withdrawal PIN. You have ${2 - currentAttempts} attempt(s) remaining.\n\n` +
        `Please enter your 4-digit withdrawal PIN:`
      );
      return;
    }

    // Delete PIN message for security
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // Ignore
    }

    console.log(`[AI Withdrawal] PIN verified for user ${userId}, executing withdrawal`);

    // Execute withdrawal
    await AICallbackHandler.executeWithdrawal(ctx, state.data, user);
  }

  /**
   * Execute the actual withdrawal transaction
   */
  private static async executeWithdrawal(
    ctx: Context,
    data: any,
    user: any
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      // Get Yara bank code (different from Paystack bank code)
      const yaraBankCode = findYaraBankCode(data.bankName!);
      if (!yaraBankCode) {
        console.error(`[AI Withdrawal] Yara bank code not found for: ${data.bankName}`);
        await ctx.reply(
          `❌ Bank "${data.bankName}" is not supported for withdrawals. Please contact support.`
        );
        clearAIWithdrawalState(userId);
        return;
      }

      console.log(`[AI Withdrawal] Using Yara bank code: ${yaraBankCode} for ${data.bankName}`);

      // Create payment widget
      const widget = config.paymentWidgetUrl;
      if (!widget) {
        await ctx.reply("❌ Payment widget URL not configured");
        clearAIWithdrawalState(userId);
        return;
      }

      const paymentOptions = {
        sender: {},
        recipient: {
          firstName: user.telegram_id.toString(),
          lastName: user.username,
          email: "dev.czdamian@gmail.com",
          phoneNumber: "+2348060864466",
          bankAccount: {
            accountNumber: data.recipient,
            bankCode: yaraBankCode  // Use Yara bank code for payment widget
          },
          address: "Jumpabot",
          city: "Jumpabot",
          country: "Jumpabot"
        },
        amount: Number(data.cryptoAmount),
        paymentRemarks: "AI Withdrawal",
        fromCurrency: data.currency,
        payoutCurrency: "NGN",
        publicKey: "pk_test_GIST",
        developerFee: "1",
        payoutType: "DIRECT_DEPOSIT"
      };

      console.log("[AI Withdrawal] Creating payment widget:", paymentOptions);

      const getPaymentWidget = await fetch(widget, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-yara-public-key": config.yaraApiKey!,
          "Accept": "application/json"
        },
        body: JSON.stringify(paymentOptions),
      });

      if (!getPaymentWidget.ok) {
        const errorText = await getPaymentWidget.text();
        throw new Error(`Payment widget API error: ${getPaymentWidget.status} - ${errorText}`);
      }

      const paymentWidget = await getPaymentWidget.json();
      console.log("[AI Withdrawal] Payment widget created:", paymentWidget);

      if (paymentWidget.error) {
        await ctx.reply(`❌ Withdrawal failed: ${paymentWidget.error}`);
        clearAIWithdrawalState(userId);
        return;
      }

      const solAddress = paymentWidget.data.solAddress;
      const ethAddress = paymentWidget.data.ethAddress;
      const depositAmount = paymentWidget.data.depositAmount;
      const fiatPayoutAmount = paymentWidget.data.fiatPayoutAmount;
      const paymentStatus = paymentWidget.data.status;

      const recipientAddress = data.chain === 'SOLANA' ? solAddress : ethAddress;
      console.log(`[AI Withdrawal] Recipient address (${data.chain}): ${recipientAddress}`);

      // Save to database
      await Withdrawal.create({
        telegram_id: userId,
        transaction_id: paymentWidget.data.id,
        fiatPayoutAmount: fiatPayoutAmount,
        depositAmount: depositAmount,
        yaraWalletAddress: recipientAddress,
        status: paymentStatus,
      });

      // Execute withdrawal based on chain and currency using pure transaction utilities
      let initTx;
      if (data.chain === 'SOLANA') {
        if (data.currency === 'SOL') {
          initTx = await executeSolTransfer(user, recipientAddress, depositAmount);
        } else if (data.currency === 'USDC') {
          initTx = await executeUSDCTransfer(user, recipientAddress, depositAmount);
        } else if (data.currency === 'USDT') {
          initTx = await executeUSDTTransfer(user, recipientAddress, depositAmount);
        }
      } else if (data.chain === 'BASE' || data.chain === 'CELO') {
        if (data.currency === 'ETH') {
          initTx = await executeETHTransfer(user, recipientAddress, depositAmount, data.chain);
        } else if (data.currency === 'USDC') {
          initTx = await executeUSDCTransferEVM(user, recipientAddress, depositAmount, data.chain);
        } else if (data.currency === 'USDT') {
          initTx = await executeUSDTTransferEVM(user, recipientAddress, depositAmount, data.chain);
        }
      }

      console.log("[AI Withdrawal] Transaction result:", initTx);

      if (initTx?.success) {
        await ctx.reply(
          `✅ Withdrawal successful!\n\n` +
          `${depositAmount} ${data.currency} sent to ${data.accountName}\n` +
          `₦${fiatPayoutAmount.toLocaleString()} will be credited to the account shortly.`
        );

        // Generate receipt
        try {
          const receiptData = {
            amount: fiatPayoutAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            amountInCrypto: depositAmount.toString(),
            currency: data.currency,
            timestamp: new Date(),
            network: data.chain === 'SOLANA' ? 'Solana' : data.chain,
            bankName: data.bankName,
            accountName: data.accountName,
            accountNumber: data.recipient,
            transactionHash: initTx.signature
          };

          const receiptBuffer = await generateTransactionReceipt(receiptData);
          await ctx.replyWithPhoto(
            { source: receiptBuffer },
            { caption: '📄 Your withdrawal receipt' }
          );
        } catch (receiptError) {
          console.error("[AI Withdrawal] Failed to generate receipt:", receiptError);
        }
      } else {
        await ctx.reply(`❌ Withdrawal failed: ${initTx?.error || 'Unknown error'}`);
      }

      clearAIWithdrawalState(userId);

    } catch (error: any) {
      console.error("[AI Withdrawal] Execution error:", error);
      await ctx.reply(`❌ Withdrawal failed: ${error.message}`);
      clearAIWithdrawalState(userId);
    }
  }

  /**
   * Find bank code from bank name (case-insensitive, fuzzy matching)
   * @param bankName - Bank name from user input
   * @returns Bank code or null if not found
   */
  private static findBankCode(bankName: string): string | null {
    const normalizedInput = bankName.toLowerCase().trim();

    console.log(`[AI Withdrawal] Looking up bank code for: "${normalizedInput}"`);

    // Try exact match first
    for (const bank of banks) {
      if (bank.name.toLowerCase() === normalizedInput) {
        console.log(`[AI Withdrawal] Exact match found: ${bank.name} -> ${bank.code}`);
        return bank.code;
      }
    }

    // Try partial match
    for (const bank of banks) {
      const normalizedBankName = bank.name.toLowerCase();
      if (normalizedBankName.includes(normalizedInput) || normalizedInput.includes(normalizedBankName)) {
        console.log(`[AI Withdrawal] Partial match found: ${bank.name} -> ${bank.code}`);
        return bank.code;
      }
    }

    // Try common abbreviations
    const abbreviations: { [key: string]: string } = {
      'gtb': 'Guaranty Trust Bank',
      'gt bank': 'Guaranty Trust Bank',
      'gtbank': 'Guaranty Trust Bank',
      'uba': 'United Bank For Africa',
      'fcmb': 'First City Monument Bank',
      'stanbic': 'Stanbic IBTC Bank',
      'access': 'Access Bank',
      'zenith': 'Zenith Bank',
      'first bank': 'First Bank of Nigeria',
      'union bank': 'Union Bank of Nigeria',
      'eco bank': 'Ecobank Nigeria',
      'ecobank': 'Ecobank Nigeria',
      'fidelity': 'Fidelity Bank',
      'wema': 'Wema Bank',
      'polaris': 'Polaris Bank',
      'sterling': 'Sterling Bank',
      'providus': 'Providus Bank',
      'unity': 'Unity Bank',
      'jaiz': 'Jaiz Bank',
      'kuda': 'Kuda Bank',
      'opay': 'OPay Digital Services Limited (OPay)',
      'palmpay': 'PalmPay',
      'moniepoint': 'Moniepoint MFB',
    };

    const abbrev = abbreviations[normalizedInput];
    if (abbrev) {
      const bank = banks.find(b => b.name.toLowerCase() === abbrev.toLowerCase());
      if (bank) {
        console.log(`[AI Withdrawal] Abbreviation match found: ${normalizedInput} -> ${bank.name} -> ${bank.code}`);
        return bank.code;
      }
    }

    console.log(`[AI Withdrawal] No bank code found for: "${bankName}"`);
    return null;
  }
}
