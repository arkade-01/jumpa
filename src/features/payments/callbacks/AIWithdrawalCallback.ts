import { Context, Markup } from "telegraf";
import {
  convertNGNToCrypto,
  convertCryptoToNGN,
} from "@features/payments/utils/convertNGNToCrypto";
import {
  setAIWithdrawalState,
  getAIWithdrawalState,
  clearAIWithdrawalState,
  updateAIWithdrawalState,
} from "@shared/state/aiWithdrawalState";
import getUser from "@features/users/getUserInfo";
import { config } from "@core/config/environment";
import Withdrawal from "@core/database/models/withdrawal";
import {
  executeSolTransfer,
  executeUSDCTransfer,
  executeUSDTTransfer,
} from "@features/payments/utils/solWithdrawTx";
import {
  executeETHTransfer,
  executeUSDCTransferEVM,
  executeUSDTTransferEVM,
  executeCELOTransfer,
} from "@features/payments/utils/evmWithdrawTx";
import { generateTransactionReceipt } from "@shared/utils/receiptGenerator";
import { findYaraBankCode } from "@features/payments/utils/yaraBankCodes";
import { processUserQuery } from "@src/ai-agent/agent.config";
import { sendOrEdit } from "@src/shared/utils/messageHelper";

/**
 * Callback Handler for detecting withdrawal intents from natural language
 * Uses AI to parse user messages and handle the flow
 */
export class AICallbackHandler {
  /**
   * Handle potential withdrawal request from user
   * @param ctx - Telegraf context
   */
  static async handleAIQuery(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !("text" in ctx.message)) {
        return;
      }

      const userMessage = ctx.message.text;
      const userId = ctx.from?.id;

      // Check for PIN entry state first - bypass AI if we are waiting for PIN
      if (userId) {
        const state = getAIWithdrawalState(userId);
        if (state && state.step === "awaiting_pin") {
          // Let the PIN handler deal with this message naturally
          // We return here to ensure we don't process the PIN as a new AI query
          await AICallbackHandler.handlePINInput(ctx);
          return;
        }
      }

      if (!userId) return;

      //don't respond in non-private chats
      if (ctx.chat.type !== "private") {
        return;
      }

      // Basic heuristic to check if this MIGHT be a withdrawal request before calling expensive AI
      const keywords = ["send", "withdraw", "transfer", "pay", "deposit", "airdrop"];
      const hasWithdrawalKeyword = keywords.some(k => userMessage.toLowerCase().includes(k));

      // Retrieve existing state to check if we are in an active conversation
      const currentState = getAIWithdrawalState(userId);
      const isProcessing = currentState?.step === "processing";

      // If NOT in active processing AND no keywords, skip
      if (!isProcessing && !hasWithdrawalKeyword) {
        return;
      }

      // IMPORTANT: If this is a NEW withdrawal request (has keywords), clear old state
      // This prevents history pollution from previous requests
      let history: any[] = [];
      if (hasWithdrawalKeyword) {
        // New request - start fresh
        clearAIWithdrawalState(userId);
        history = [];
      } else if (isProcessing && currentState?.data?.history) {
        // Follow-up message in existing conversation - keep history
        history = currentState.data.history;
      }

      // Call the AI Agent
      const aiResponse = await processUserQuery(userId, userMessage, history);

      if (aiResponse.type === "error") {
        console.error(`[AI Withdrawal] AI Error: ${aiResponse.message}`);
        // Optional: reply to user about error, or just ignore if unrelated
        return;
      }

      if (aiResponse.type === "text") {
        // Agent is asking for more info or clarifying
        // Save state with updated history
        if (aiResponse.updatedHistory) {
          setAIWithdrawalState(userId, "processing", {
            history: aiResponse.updatedHistory,
            // Keep existing data if available (though strictly we rely on history now until confirmation)
            ...currentState?.data
          });
        }

        await ctx.reply(aiResponse.message || "Please check your details.", {
          parse_mode: "Markdown"
        });
      }

      if (aiResponse.type === "confirmation") {
        // Agent successfully gathered everything and validated
        const data = aiResponse.data;

        console.log("[AI Withdrawal] AI confirmed withdrawal details:", data);

        await AICallbackHandler.initiatePINFlow(ctx, {
          amount: data.amount,
          amount_currency: data.amount_currency,
          recipient: data.account_number,
          bankName: data.bank_name,
          accountName: data.account_name,
          chain: data.chain,
          currency: data.currency,
          wallet_address: data.wallet_address,
        });
      }

    } catch (error: any) {
      console.error("[AI Withdrawal] Error in handleAIQuery:", error);
    }
  }

  /**
   * Sets up the state for PIN entry and asks the user for PIN
   */
  private static async initiatePINFlow(ctx: Context, data: any): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Calculate crypto amount
    let cryptoAmount = 0;

    // Check if amount is already in crypto
    if (data.amount_currency && data.amount_currency !== 'NGN') {
      console.log(`[AI Withdrawal] Amount specified in Native Crypto: ${data.amount} ${data.amount_currency}`);
      // Direct assignment (assuming user asked for 10 USDT and currency is USDT)
      // We might want to verify data.amount_currency === data.currency, but let's trust the agent's extraction for now.
      // If user said "10 USDT" and source currency is "USDT", then amount is 10.
      cryptoAmount = data.amount;
    } else {
      // Default NGN behavior
      console.log(`[AI Withdrawal] Amount specified in NGN: ${data.amount}`);
      cryptoAmount = await convertNGNToCrypto(
        data.amount,
        data.currency,
        data.chain
      );
    }

    // If Bank Transfer, find the verified bank code
    let bankCode = null;
    if (!data.wallet_address) {
      const bName = data.bankName || data.bank_name;
      if (bName) {
        bankCode = findYaraBankCode(bName);
      } else {
        // This should ideally strictly be caught by tool validation, but 
        // to prevent runtime crashes if the AI hallucinates inconsistent data:
        console.warn("[AI Withdrawal] Missing bank name in bank flow. Skipping code lookup.");
      }
    }

    // Store state
    setAIWithdrawalState(userId, "awaiting_pin", {
      ...data,
      bankCode: bankCode,
      cryptoAmount,
      pinAttempts: 0
    });

    let confirmationMessage = "";

    if (data.wallet_address) {
      // CRYPTO WITHDRAWAL MESSAGE
      confirmationMessage =
        `*Please enter your 4-digit PIN to confirm Crypto Transfer:*\n\n` +
        `Amount: *${cryptoAmount} ${data.currency}*\n` +
        `Chain: *${data.chain}*\n` +
        `To Wallet: \`${data.wallet_address}\`\n`;

    } else {
      // BANK WITHDRAWAL MESSAGE
      confirmationMessage =
        `*Please enter your 4-digit PIN to confirm Bank Withdrawal:*\n\n` +
        `Amount: *₦${data.amount.toLocaleString()}* (${cryptoAmount} ${data.currency})\n` +
        `Chain: *${data.chain}*\n` +
        `To: *${data.accountName || data.account_name}*\n` +
        `Bank: *${data.bankName || data.bank_name}*\n` +
        `Account: \`${data.account_number || data.recipient || data.accountnumber}\`\n`;
    }

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
    if (!state || state.step !== "awaiting_pin") {
      return;
    }

    const enteredPin = message.trim();

    // Validate PIN format
    if (!/^\d{4}$/.test(enteredPin)) {
      await ctx.reply(
        "❌ Invalid PIN format. Please enter a 4-digit numeric PIN."
      );
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
        `❌ Incorrect withdrawal PIN. You have ${2 - currentAttempts
        } attempt(s) remaining.\n\n` +
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

    console.log(
      `[AI Withdrawal] PIN verified for user ${userId}, executing withdrawal`
    );

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
      let recipientAddress = "";

      // ==========================================
      // FLOW A: DIRECT CRYPTO TRANSFER (ON-CHAIN)
      // ==========================================
      if (data.wallet_address) {
        console.log(`[AI Withdrawal] Executing Direct Crypto Transfer to ${data.wallet_address}`);
        recipientAddress = data.wallet_address;

        // No Yara Widget needed. Direct blockchain transfer.
        // We'll set fiatPayoutAmount to user's amount (just for record keeping, though usually fees apply)

        // We call the transfer functions directly later in the code.
        // Just need to skip the Yara widget creation block.

      }
      // ==========================================
      // FLOW B: BANK TRANSFER (VIA YARA)
      // ==========================================
      else {
        console.log(`[AI Withdrawal] Executing Bank Transfer via Yara`);

        const bankName = data.bankName || data.bank_name;
        // Get Yara bank code (different from Paystack bank code)
        const yaraBankCode = findYaraBankCode(bankName);
        if (!yaraBankCode) {
          console.error(
            `[AI Withdrawal] Yara bank code not found for: ${bankName}`
          );
          await ctx.reply(
            `❌ Bank "${bankName}" is not supported for withdrawals. Please contact support.`
          );
          clearAIWithdrawalState(userId);
          return;
        }

        console.log(
          `[AI Withdrawal] Using Yara bank code: ${yaraBankCode} for ${bankName}`
        );

        // Create payment widget
        const widget = config.paymentWidgetUrl;
        if (!widget) {
          await ctx.reply("❌ Payment widget URL not configured");
          clearAIWithdrawalState(userId);
          return;
        }

        const recipientNumber = data.recipient || data.account_number;

        const paymentOptions = {
          sender: {},
          recipient: {
            firstName: user.telegram_id.toString(),
            lastName: user.username,
            email: "dev.czdamian@gmail.com",
            phoneNumber: "+2348060864466",
            bankAccount: {
              accountNumber: recipientNumber,
              bankCode: yaraBankCode, // Use Yara bank code for payment widget
            },
            address: "Jumpabot",
            city: "Jumpabot",
            country: "Jumpabot",
          },
          amount: Number(data.cryptoAmount),
          paymentRemarks: "AI Withdrawal",
          fromCurrency: data.currency,
          payoutCurrency: "NGN",
          publicKey: "pk_test_GIST",
          developerFee: "1",
          payoutType: "DIRECT_DEPOSIT",
        };

        console.log("[AI Withdrawal] Creating payment widget:", paymentOptions);

        const getPaymentWidget = await fetch(widget, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-yara-public-key": config.yaraApiKey!,
            Accept: "application/json",
          },
          body: JSON.stringify(paymentOptions),
        });

        if (!getPaymentWidget.ok) {
          const errorText = await getPaymentWidget.text();
          throw new Error(
            `Payment widget API error: ${getPaymentWidget.status} - ${errorText}`
          );
        }

        const paymentWidget = await getPaymentWidget.json();
        console.log("[AI Withdrawal] Payment widget created:", paymentWidget);

        if (paymentWidget.error) {
          await ctx.reply(`❌ Withdrawal failed: ${paymentWidget.error}`);
          clearAIWithdrawalState(userId);
          return;
        }

        // Yara returns an address where WE should send funds to settle the payment
        const solAddress = paymentWidget.data.solAddress;
        const ethAddress = paymentWidget.data.ethAddress;

        // This is the address we send TO
        recipientAddress = data.chain === "SOLANA" ? solAddress : ethAddress;

        console.log(`[AI Withdrawal] Yara requires funding at: ${recipientAddress}`);

        // Save Widget Transaction to DB
        // ... (Database logic can remain similar, focusing on tracking)
        await Withdrawal.create({
          telegram_id: userId,
          transaction_id: paymentWidget.data.id,
          fiatPayoutAmount: paymentWidget.data.fiatPayoutAmount,
          depositAmount: paymentWidget.data.depositAmount,
          yaraWalletAddress: recipientAddress,
          status: paymentWidget.data.status,
        });
      }

      console.log(
        `[AI Withdrawal] Recipient address (${data.chain}): ${recipientAddress} | Amount: ${data.cryptoAmount}`
      );

      // Execute withdrawal based on chain and currency using pure transaction utilities
      let initTx;
      const depositAmount = Number(data.cryptoAmount);
      await sendOrEdit(ctx, "Processing withdrawal...");

      if (data.chain === "SOLANA") {
        if (data.currency === "SOL") {
          initTx = await executeSolTransfer(
            user,
            recipientAddress,
            depositAmount
          );
        } else if (data.currency === "USDC") {
          initTx = await executeUSDCTransfer(
            user,
            recipientAddress,
            depositAmount
          );
        } else if (data.currency === "USDT") {
          initTx = await executeUSDTTransfer(
            user,
            recipientAddress,
            depositAmount
          );
        }
      } else if (data.chain === "BASE" || data.chain === "CELO") {
        if (data.currency === "ETH") {
          initTx = await executeETHTransfer(
            user,
            recipientAddress,
            depositAmount,
            data.chain
          );
        } else if (data.currency === "USDC") {
          initTx = await executeUSDCTransferEVM(
            user,
            recipientAddress,
            depositAmount,
            data.chain
          );
        } else if (data.currency === "USDT") {
          initTx = await executeUSDTTransferEVM(
            user,
            recipientAddress,
            depositAmount,
            data.chain
          );
        } else if (data.currency === "CELO" && data.chain === "CELO") {
          initTx = await executeCELOTransfer(
            user,
            recipientAddress,
            depositAmount
          );
        }
      }

      console.log("[AI Withdrawal] Transaction result:", initTx);

      if (initTx?.success) {

        let successMsg = "";

        if (data.wallet_address) {
          successMsg = `✅ **Withdrawal Successful!**\n\n` +
            `Sent: \`${depositAmount} ${data.currency}\`\n` +
            `To: \`${data.wallet_address}\`\n` +
            `Chain: ${data.chain}`;
        } else {
          successMsg = `✅ **Withdrawal Initiated!**\n\n` +
            `Sent: ${depositAmount} ${data.currency}\n` +
            `To: ${data.accountName || data.account_name}\n` +
            `Account credited shortly.`;
        }

        await sendOrEdit(ctx, successMsg, { parse_mode: "Markdown" });

      } else {
        await sendOrEdit(ctx, `❌ Withdrawal failed: ${initTx?.error || "Unknown error"}`);
      }

      clearAIWithdrawalState(userId);
    } catch (error: any) {
      console.error("[AI Withdrawal] Execution error:", error);
      await ctx.reply(`❌ Withdrawal failed: ${error.message}`);
      clearAIWithdrawalState(userId);
    }
  }
}

