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
import { signTransaction } from "@src/blockchain/amadeus/amadeusFunctions";
import { decryptPrivateKey } from "@src/shared/utils/encryption";
import { MCPRegistry } from "@core/mcp/MCPRegistry";

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
      const message = ctx.message as any;
      console.log("[AI Image Handler] Message received:", {
        hasText: !!message?.text,
        hasPhoto: !!message?.photo,
        hasCaption: !!message?.caption,
        photoCount: message?.photo?.length || 0
      });

      if (!message || (!message.text && !message.photo && !message.caption)) {
        console.log("[AI Image Handler] Message rejected - no text, photo, or caption");
        return;
      }

      const userMessage = message.text || message.caption || "";
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

      // Dynamic Intent Check: Check if message matches any tool keyword
      // If image is present, process it
      const keywords = await MCPRegistry.getInstance().getDynamicKeywords();
      const hasWithdrawalKeyword = keywords.some(k => userMessage.toLowerCase().includes(k));
      const hasPhoto = !!message.photo;

      // Retrieve existing state to check if we are in an active conversation
      const currentState = getAIWithdrawalState(userId);
      const isProcessing = currentState?.step === "processing";

      console.log("[AI Image Handler] Intent check:", {
        hasWithdrawalKeyword,
        hasPhoto,
        isProcessing,
        keywords: keywords.slice(0, 5)
      });

      // If NOT in active processing AND no keywords AND no photo, skip
      if (!isProcessing && !hasWithdrawalKeyword && !hasPhoto) {
        console.log("[AI Image Handler] Skipping - no active processing, keywords, or photo");
        return;
      }

      console.log("[AI Image Handler] Processing message - conditions met");

      // IMPORTANT: If this is a NEW withdrawal request (has keywords or photo), clear old state
      // This prevents history pollution from previous requests
      let history: any[] = [];
      if (hasWithdrawalKeyword || hasPhoto) {
        // New request - start fresh
        clearAIWithdrawalState(userId);
        history = [];
      } else if (isProcessing && currentState?.data?.history) {
        // Follow-up message in existing conversation - keep history
        history = currentState.data.history;
      }

      // Fetch user info to get Amadeus address provided they have one
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
      const user = await getUser(userId, username);

      let systemInjection = "";
      if (user && user.amadeusWallets && user.amadeusWallets.length > 0) {
        const userAddress = user.amadeusWallets[0].publicKey;
        systemInjection = `OFFICIAL SIGNER ADDRESS: ${userAddress}. Use this address for 'signer' in create_transaction.`;
      }

      // If this is a new session, inject the signer info
      if (!history.length && systemInjection) {
        history.push({ role: "user", content: systemInjection });
      }

      // Call the AI Agent
      let finalMessage: string | any[] = userMessage;

      // Handle Photo Processing
      if (hasPhoto) {
        console.log("[AI Image Handler] Photo detected - starting processing");
        await ctx.sendChatAction("upload_photo");

        // Get the largest photo (last in array)
        const photo = message.photo[message.photo.length - 1];
        const fileId = photo.file_id;
        console.log("[AI Image Handler] Photo file ID:", fileId);

        try {
          const fileLink = await ctx.telegram.getFileLink(fileId);
          console.log("[AI Image Handler] Got file link:", fileLink.toString());

          // Fetch the image
          const response = await fetch(fileLink.toString());
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Image = buffer.toString("base64");
          console.log("[AI Image Handler] Image downloaded and converted to base64, size:", base64Image.length, "chars");

          // Construct Multimodal Message
          finalMessage = [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg", // Telegram photos are usually JPEGs
                data: base64Image,
              },
            },
            {
              type: "text",
              text: userMessage || "Please extract the withdrawal details from this image.",
            }
          ];
          console.log("[AI Image Handler] Multimodal message constructed with", finalMessage.length, "blocks");
        } catch (err) {
          console.error("[AI Image Handler] Error processing photo:", err);
          return;
        }
      } else if (systemInjection && !history.length) {
        // If text only and system injection needed
        finalMessage = `${systemInjection}\n\n${userMessage}`;
      }

      console.log("[AI Image Handler] Calling processUserQuery with message type:", Array.isArray(finalMessage) ? 'multimodal' : 'text');
      const aiResponse = await processUserQuery(userId, finalMessage, history);
      console.log("[AI Image Handler] AI Response type:", aiResponse.type);

      if (aiResponse.type === "error") {
        console.error(`[AI Withdrawal] AI Error: ${aiResponse.message} ${aiResponse?.data} ${aiResponse?.type}`);
        // Silent failure as requested
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

      if (aiResponse.type === "bulk_confirmation") {
        // Agent confirmed bulk withdrawal
        const data = aiResponse.data;
        console.log("[AI Withdrawal] AI confirmed bulk withdrawal:", data);

        await AICallbackHandler.initiateBulkPINFlow(ctx, {
          recipients: data.recipients,
          chain: data.chain,
          currency: data.currency,
        });
      }

      if (aiResponse.type === "signature_request") {
        const data = aiResponse.data;
        // Pass the updated history which now contains the tool result
        await AICallbackHandler.initiateAmadeusSignatureFlow(ctx, data, aiResponse.updatedHistory);
      }

    } catch (error: any) {
      console.error("[AI Withdrawal] Error in handleAIQuery:", error);
    }
  }

  /**
   * Sets up state for Amadeus Transaction Signature
   */
  private static async initiateAmadeusSignatureFlow(ctx: Context, data: any, history: any[] = []): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Store state
    // Store state with history
    setAIWithdrawalState(userId, "awaiting_amadeus_confirmation", {
      transactionBlob: data.blob,
      signingPayload: data.payload,
      toolName: data.toolName,
      rawResult: data.rawResult,
      history: history, // Persist history
      pinAttempts: 0
    });

    const confirmationMessage =
      `🔐 **Confirm Transaction**\n\n` +
      `Click **Confirm** to approve the transaction.`;

    await ctx.reply(confirmationMessage, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("❌ Reject", "ai_withdraw_cancel"),
          Markup.button.callback("✅ Confirm", "confirm_amadeus_tx")
        ]
      ])
    });
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
   * Sets up the state for bulk transfer PIN entry
   */
  private static async initiateBulkPINFlow(ctx: Context, data: any): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Store state with bulk recipients
    setAIWithdrawalState(userId, "awaiting_bulk_pin", {
      recipients: data.recipients,
      chain: data.chain,
      currency: data.currency,
      pinAttempts: 0
    });

    // Build confirmation message showing all recipients
    let recipientList = "";
    let totalNGN = 0;

    for (let i = 0; i < data.recipients.length; i++) {
      const recipient = data.recipients[i];
      const amount = recipient.amount;
      let destination = "";

      if (recipient.wallet_address) {
        destination = `${recipient.wallet_address.slice(0, 6)}...${recipient.wallet_address.slice(-4)}`;
      } else {
        destination = `${recipient.account_name} (${recipient.bank_name})`;
      }

      recipientList += `${i + 1}. ${destination} - *${amount.toLocaleString()} ${recipient.amount_currency}*\n`;

      if (recipient.amount_currency === 'NGN') {
        totalNGN += amount;
      }
    }

    const confirmationMessage =
      `*Please enter your 4-digit PIN to confirm Bulk Transfer:*\n\n` +
      `Recipients (${data.recipients.length}):\n${recipientList}\n` +
      `Chain: *${data.chain}*\n` +
      `Currency: *${data.currency}*\n`;

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
   * Handle Amadeus Confirmation Button Logic
   */
  static async handleAmadeusConfirmation(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

    if (!userId) return;

    try {
      const state = getAIWithdrawalState(userId);
      if (!state || state.step !== "awaiting_amadeus_confirmation") {
        await ctx.answerCbQuery("❌ Session expired.");
        return;
      }

      const user = await getUser(userId, username);
      if (!user) {
        await ctx.answerCbQuery("❌ User not found.");
        return;
      }

      // Delete the confirmation message
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore
      }

      await ctx.answerCbQuery("✅ Processing...");

      // Execute directly
      await AICallbackHandler.executeAmadeusTransaction(ctx, state.data, user);

    } catch (error: any) {
      console.error("Amadeus Confirmation Error:", error);
      await ctx.answerCbQuery("❌ Error processing request");
    }
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
    if (!state || (state.step !== "awaiting_pin" && state.step !== "awaiting_bulk_pin")) {
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

    // Execute withdrawal (single or bulk)
    if (state.step === "awaiting_bulk_pin") {
      await AICallbackHandler.executeBulkWithdrawal(ctx, state.data, user);
    } else {
      await AICallbackHandler.executeWithdrawal(ctx, state.data, user);
    }
  }

  /**
   * Execute Amadeus Transaction
   */
  public static async executeAmadeusTransaction(
    ctx: Context,
    data: any,
    user: any
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      await ctx.sendChatAction("typing");

      // 1. Get User's Amadeus Private Key
      // Use default (first) wallet
      if (!user.amadeusWallets || user.amadeusWallets.length === 0) {
        throw new Error("No Amadeus wallet found for this user.");
      }

      const encryptedKey = user.amadeusWallets[0].encryptedPrivateKey;
      const decryptedHexKey = decryptPrivateKey(encryptedKey);

      // Amadeus keys are stored as Hex-encoded UTF8 strings of the Base58 key
      // Convert back to original Base58 string
      const privateKey = Buffer.from(decryptedHexKey, 'hex').toString('utf8');

      // 2. Sign Transaction
      const signature = signTransaction(data.signingPayload, privateKey);

      // 3. Submit Transaction
      // We use the generic executeTool from registry
      // 'submit_transaction' params: { transaction, signature, network: 'testnet' }

      // 3. AI-Driven Submission
      // The AI (via processUserQuery loop) will:
      // a) Call 'submit_transaction' tool
      // b) Parse the result
      // c) Generate the final response

      const history = data.history || [];
      const userFollowUp = `Transaction signed. 
Signature: ${signature}
Transaction Blob: ${data.transactionBlob}
Please submit the transaction now.`;


      // await sendOrEdit(ctx, "🔄 Submitting transaction via Agent...");

      const aiResponse = await processUserQuery(userId, userFollowUp, history);

      if (aiResponse.type === 'text') {
        const responseText = aiResponse.message || "Transaction processed.";
        await sendOrEdit(ctx, responseText, { parse_mode: "Markdown" });
      } else if (aiResponse.type === 'error') {
        throw new Error(aiResponse.message);
      } else {
        console.warn("[AI Agent] Unexpected response type during submission:", aiResponse.type);
        await sendOrEdit(ctx, "⚠️ Transaction processed, but response was unexpected.");
      }

      clearAIWithdrawalState(userId);

    } catch (error: any) {
      console.error("[AI Agent] Amadeus Execution Error:", error);
      await ctx.reply(`❌ Transaction Failed: ${error.message} `);
      clearAIWithdrawalState(userId);
    }
  }

  /**
   * Internal method: Execute a single transfer WITHOUT messaging or state management
   * Returns result object for bulk processing
   */
  private static async _executeSingleTransferSilent(
    ctx: Context,
    data: any,
    user: any
  ): Promise<{ success: boolean, error?: string, transactionId?: string, recipient: string }> {
    const userId = ctx.from?.id;
    if (!userId) {
      return { success: false, error: "No user ID", recipient: "unknown" };
    }

    try {
      let recipientAddress = "";
      let recipientName = data.wallet_address || `${data.accountName || data.account_name}`;

      // FLOW A: DIRECT CRYPTO TRANSFER
      if (data.wallet_address) {
        console.log(`[Silent Transfer] Crypto transfer to ${data.wallet_address}`);
        recipientAddress = data.wallet_address;
      }
      // FLOW B: BANK TRANSFER (VIA YARA)
      else {
        console.log(`[Silent Transfer] Bank transfer via Yara`);

        const bankName = data.bankName || data.bank_name;
        const yaraBankCode = findYaraBankCode(bankName);

        if (!yaraBankCode) {
          return { success: false, error: `Bank "${bankName}" not supported`, recipient: recipientName };
        }

        const widget = config.paymentWidgetUrl;
        if (!widget) {
          return { success: false, error: "Payment widget URL not configured", recipient: recipientName };
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
              bankCode: yaraBankCode,
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
          return {
            success: false,
            error: `Payment widget error: ${getPaymentWidget.status}`,
            recipient: recipientName
          };
        }

        const paymentWidget = await getPaymentWidget.json();

        if (paymentWidget.error) {
          return { success: false, error: paymentWidget.error, recipient: recipientName };
        }

        const solAddress = paymentWidget.data.solAddress;
        const ethAddress = paymentWidget.data.ethAddress;
        recipientAddress = data.chain === "SOLANA" ? solAddress : ethAddress;

        // Save to DB with batch_id if provided
        await Withdrawal.create({
          telegram_id: userId,
          transaction_id: paymentWidget.data.id,
          fiatPayoutAmount: paymentWidget.data.fiatPayoutAmount,
          depositAmount: paymentWidget.data.depositAmount,
          yaraWalletAddress: recipientAddress,
          status: paymentWidget.data.status,
          batch_id: data.batch_id, // Optional batch ID for grouping
        });
      }

      // Execute blockchain transfer
      let initTx;
      const depositAmount = Number(data.cryptoAmount);

      if (data.chain === "SOLANA") {
        if (data.currency === "SOL") {
          initTx = await executeSolTransfer(user, recipientAddress, depositAmount);
        } else if (data.currency === "USDC") {
          initTx = await executeUSDCTransfer(user, recipientAddress, depositAmount);
        } else if (data.currency === "USDT") {
          initTx = await executeUSDTTransfer(user, recipientAddress, depositAmount);
        }
      } else if (data.chain === "BASE" || data.chain === "CELO") {
        if (data.currency === "ETH") {
          initTx = await executeETHTransfer(user, recipientAddress, depositAmount, data.chain);
        } else if (data.currency === "USDC") {
          initTx = await executeUSDCTransferEVM(user, recipientAddress, depositAmount, data.chain);
        } else if (data.currency === "USDT") {
          initTx = await executeUSDTTransferEVM(user, recipientAddress, depositAmount, data.chain);
        } else if (data.currency === "CELO" && data.chain === "CELO") {
          initTx = await executeCELOTransfer(user, recipientAddress, depositAmount);
        }
      }

      if (initTx?.success) {
        return {
          success: true,
          transactionId: initTx.signature || initTx.hash,
          recipient: recipientName
        };
      } else {
        return {
          success: false,
          error: initTx?.error || "Transfer failed",
          recipient: recipientName
        };
      }

    } catch (error: any) {
      console.error("[Silent Transfer] Error:", error);
      return {
        success: false,
        error: error.message,
        recipient: data.accountName || data.wallet_address || "unknown"
      };
    }
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
      await sendOrEdit(ctx, "Processing withdrawal...");

      // Use silent method for actual transfer
      const result = await AICallbackHandler._executeSingleTransferSilent(ctx, data, user);

      if (result.success) {
        let successMsg = "";

        if (data.wallet_address) {
          successMsg = `✅ **Withdrawal Successful!**\n\n` +
            `Sent: \`${Number(data.cryptoAmount)} ${data.currency}\`\n` +
            `To: \`${data.wallet_address}\`\n` +
            `Chain: ${data.chain}`;
        } else {
          successMsg = `✅ **Withdrawal Initiated!**\n\n` +
            `Sent: ${Number(data.cryptoAmount)} ${data.currency}\n` +
            `To: ${data.accountName || data.account_name}\n` +
            `Account credited shortly.`;
        }

        await sendOrEdit(ctx, successMsg, { parse_mode: "Markdown" });
      } else {
        await sendOrEdit(ctx, `❌ Withdrawal failed: ${result.error || "Unknown error"}`);
      }

      clearAIWithdrawalState(userId);
    } catch (error: any) {
      console.error("[AI Withdrawal] Execution error:", error);
      await ctx.reply(`❌ Withdrawal failed: ${error.message}`);
      clearAIWithdrawalState(userId);
    }
  }

  /**
   * Execute bulk withdrawal - processes multiple recipients sequentially
   */
  private static async executeBulkWithdrawal(
    ctx: Context,
    data: any,
    user: any
  ): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const { recipients, chain, currency } = data;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const results: Array<{ index: number, success: boolean, error?: string, recipient: string }> = [];

    try {
      await ctx.reply(`🔄 Processing ${recipients.length} transfers...`);

      // Process each recipient sequentially
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        console.log(`[Bulk Withdrawal] Processing ${i + 1}/${recipients.length}`);

        // Convert NGN to crypto if needed
        let cryptoAmount = recipient.amount;
        if (recipient.amount_currency === 'NGN') {
          try {
            cryptoAmount = await convertNGNToCrypto(recipient.amount, currency, chain);
            console.log(`[Bulk Withdrawal] Converted ${recipient.amount} NGN to ${cryptoAmount} ${currency}`);
          } catch (e: any) {
            console.error(`[Bulk Withdrawal] Conversion failed for recipient ${i + 1}:`, e);
            results.push({
              index: i + 1,
              success: false,
              error: `Currency conversion failed: ${e.message}`,
              recipient: recipient.account_name || recipient.wallet_address || "Unknown"
            });
            continue;
          }
        }

        const transferData = {
          amount: recipient.amount,
          amount_currency: recipient.amount_currency,
          account_number: recipient.account_number,
          bank_name: recipient.bank_name,
          accountName: recipient.account_name,
          wallet_address: recipient.wallet_address,
          chain,
          currency,
          cryptoAmount: cryptoAmount, // Use converted amount
          batch_id: batchId,
        };

        // Use silent method
        const result = await AICallbackHandler._executeSingleTransferSilent(ctx, transferData, user);

        results.push({
          index: i + 1,
          success: result.success,
          error: result.error,
          recipient: result.recipient
        });

        console.log(`[Bulk Withdrawal] ${i + 1}/${recipients.length}: ${result.success ? 'Success' : 'Failed'}`);

        // Delay between transfers
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Format and send summary
      const summary = AICallbackHandler._formatBulkSummary(results, recipients);
      await ctx.reply(summary, { parse_mode: "Markdown" });

      clearAIWithdrawalState(userId);

    } catch (error: any) {
      console.error("[Bulk Withdrawal] Fatal error:", error);
      await ctx.reply(`❌ Bulk withdrawal failed: ${error.message}`);
      clearAIWithdrawalState(userId);
    }
  }

  /**
   * Format bulk transfer summary
   */
  private static _formatBulkSummary(results: any[], recipients: any[]): string {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    let summary = `\n📊 **Bulk Transfer Complete**\n\n`;
    summary += `Total: ${results.length} | ✅ Success: ${successCount} | ❌ Failed: ${failureCount}\n\n`;

    for (const result of results) {
      const recipient = recipients[result.index - 1];
      const amount = recipient.amount;
      const currency = recipient.amount_currency;

      if (result.success) {
        summary += `${result.index}. ✅ ${result.recipient} - ${amount} ${currency}\n\n`;
      } else {
        summary += `${result.index}. ❌ ${result.recipient} - Failed: ${result.error}\n\n`;
      }
    }

    return summary;
  }
}
