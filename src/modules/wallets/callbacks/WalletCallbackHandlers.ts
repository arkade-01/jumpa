import { Context, Markup } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { config } from "@core/config/config";
import Withdrawal from "@database/models/withdrawal";
import { WithdrawSolToNgn, WithdrawUSDCToNgn, WithdrawUSDTToNgn } from "@modules/payments/commands/WithdrawToNgn";
import { withdrawETHToNGN, withdrawUSDCToNGN as withdrawUSDCToNGNEVM, withdrawUSDTToNGN as withdrawUSDTToNGNEVM } from "@modules/payments/commands/EvmWithdrawal";
import { safeDeleteMessage } from "@shared/utils/messageUtils";
import { clearWithdrawalState, getWithdrawalState, setWithdrawalState } from "@shared/state/withdrawalState";
import { WalletViewHandlers } from "@modules/onboarding/callbacks/WalletViewHandlers";

export class WalletCallbackHandlers {
    static async handleDeposit(ctx: Context): Promise<void> {
        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        const user = await getUser(telegramId, username);

        if (!user) {
            await ctx.reply(
                "❌ User not found. Please use /start to register first."
            );
            return;
        }

        const message = `Fund your wallet by sending SOL to your wallet address:\n\n\`${user.solanaWallets[0].address}\``;

        await ctx.reply(message, { parse_mode: "Markdown" });
    }

    static async handleWithdraw(ctx: Context): Promise<void> {
        const keyboard = Markup.inlineKeyboard(
            [[
                Markup.button.callback("🏧To NGN Bank Account", "withdraw_to_bank"),
                Markup.button.callback("Set Withdrawal Pin", "set_withdrawal_pin"),
            ], [
                Markup.button.callback("❌ Cancel", "delete_message"),
            ],]
        );

        await ctx.reply("Where would you like to withdraw to? Make sure you have setup your withdrawal pin to avoid unauthorized withdrawals from your account", keyboard);
    }

    static async handleWithdrawToBank(ctx: Context): Promise<void> {
        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        const user = await getUser(telegramId, username);

        if (!user) {
            await ctx.reply(
                "❌ User not found. Please use /start to register first."
            );
            return;
        }

        if (!user.bank_details.bank_name || !user.bank_details.account_name || !user.bank_details.account_number) {
            await ctx.reply("Please set up your bank details first.");
            return;
        }
        if (!user.bank_details.withdrawalPin) {
            await ctx.reply("Please set up your withdrawal pinfirst.");
            return;
        }

        const message = `Select the currency you want to withdraw to NGN. For EVM chains, we only support the following blockchains for now: CELO, BASE, OPTIMISM, POLYGON, ARBITRUM.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("SOL (SOL)", "withdraw_currency:SOL:SOLANA"),
                Markup.button.callback("USDC (SOL)", "withdraw_currency:USDC:SOLANA"),
                Markup.button.callback("USDT (SOL)", "withdraw_currency:USDT:SOLANA"),
            ], [
                Markup.button.callback("ETH (EVM)", "withdraw_currency:ETH:EVM"),
                Markup.button.callback("USDC (EVM)", "withdraw_currency:USDC:EVM"),
                Markup.button.callback("USDT (EVM)", "withdraw_currency:USDT:EVM"),
            ],
            [
                Markup.button.callback("❌ Cancel", "delete_message"),
            ],
        ]);

        await ctx.reply(message, keyboard);
    }

    static async handleWithdrawCurrencySelection(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, USDT, or ETH
        const chain = parts[2]; // SOLANA or EVM

        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        const user = await getUser(telegramId, username);

        if (!user) {
            await ctx.reply(
                "❌ User not found. Please use /start to register first."
            );
            return;
        }

        const rateUrl = config.paymentRateUrl;

        if (!rateUrl) {
            await ctx.reply("Exchange URL not specified");
            return;
        }

        const exchangeRate = await fetch(rateUrl);
        const rate = await exchangeRate.json();
        console.log("rate: ", rate)

        // Calculate rates based on currency
        let rateMessage = "";
        if (currency === "SOL") {
            rateMessage = `1 USD = ₦${(rate.data.sell.NGN).toFixed(2)}\n\n0.1 ${currency} = ₦${(0.1 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}\n0.2 ${currency} = ₦${(0.2 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}\n0.3 ${currency} = ₦${(0.3 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}`;
        } else if (currency === "ETH") {
            // ETH rate calculation - rate.data.sell.ETH is ETH per USD, so invert to get USD per ETH
            const usdPerEth = rate.data.sell.ETH ? (1 / rate.data.sell.ETH) : 3361.13;
            const usdToNgn = rate.data.sell.NGN;
            rateMessage = `1 USD = ₦${usdToNgn.toFixed(2)}\n\n0.001 ${currency} = ₦${(0.001 * usdPerEth * usdToNgn).toFixed(2)}\n0.005 ${currency} = ₦${(0.005 * usdPerEth * usdToNgn).toFixed(2)}\n0.01 ${currency} = ₦${(0.01 * usdPerEth * usdToNgn).toFixed(2)}`;
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            const usdToNgn = rate.data.sell.NGN;
            rateMessage = `1 USD = ₦${usdToNgn.toFixed(2)}\n\n2 ${currency} = ₦${(2 * usdToNgn).toFixed(2)}\n5 ${currency} = ₦${(5 * usdToNgn).toFixed(2)}\n10 ${currency} = ₦${(10 * usdToNgn).toFixed(2)}`;
        }

        let minAmountText = "";
        if (currency === "SOL") {
            minAmountText = "Minimum: 0.01 SOL";
        } else if (currency === "ETH") {
            minAmountText = `Minimum: 0.001 ${currency}`;
        } else {
            minAmountText = `Minimum: 2.5 ${currency}`;
        }

        const message = `Your selected bank account:\n\nBank: ${user.bank_details.bank_name}\nAccount Name: ${user.bank_details.account_name}\nAccount Number: ${user.bank_details.account_number}\n\n📊 Current Exchange Rates:\n\n${rateMessage}\n\n⚠️ ${minAmountText}\n\nRate expires in 30 seconds. Message auto deletes in 30 seconds`;

        // Create amount buttons based on currency
        const amountButtons = [];
        if (currency === "SOL") {
            amountButtons.push([
                Markup.button.callback("✏️ Custom Amount", `withdraw_custom_amount:${currency}:${chain}`),
            ], [
                Markup.button.callback("0.1 SOL", `withdraw_amount:${currency}:0.1:${chain}`),
                Markup.button.callback("0.5 SOL", `withdraw_amount:${currency}:0.5:${chain}`),
                Markup.button.callback("1 SOL", `withdraw_amount:${currency}:1:${chain}`),
            ]);
        } else if (currency === "ETH") {
            amountButtons.push([
                Markup.button.callback("✏️ Custom Amount", `withdraw_custom_amount:${currency}:${chain}`),
            ], [
                Markup.button.callback("0.001 ETH", `withdraw_amount:${currency}:0.001:${chain}`),
                Markup.button.callback("0.005 ETH", `withdraw_amount:${currency}:0.005:${chain}`),
                Markup.button.callback("0.01 ETH", `withdraw_amount:${currency}:0.01:${chain}`),
                Markup.button.callback("0.05 ETH", `withdraw_amount:${currency}:0.05:${chain}`),
            ]);
        } else {
            // For USDC and USDT, use different amounts (higher values since they're stablecoins)
            amountButtons.push([
                Markup.button.callback("✏️ Custom Amount", `withdraw_custom_amount:${currency}:${chain}`),
            ], [
                Markup.button.callback("2.5 " + currency, `withdraw_amount:${currency}:2.5:${chain}`),
                Markup.button.callback("5 " + currency, `withdraw_amount:${currency}:5:${chain}`),
                Markup.button.callback("10 " + currency, `withdraw_amount:${currency}:10:${chain}`),
                Markup.button.callback("20 " + currency, `withdraw_amount:${currency}:20:${chain}`),
            ]);
        }

        const keyboard = Markup.inlineKeyboard([
            ...amountButtons,
            [
                Markup.button.callback("❌ Decline", "delete_message"),
            ],
        ]);

        const reply = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, reply.message_id);
    }

    static async handleWithdrawCustomAmount(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_custom_amount:CURRENCY:CHAIN
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, USDT, or ETH
        const chain = parts[2]; // SOLANA or EVM

        const telegramId = ctx.from?.id;

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        // Set state to await custom amount input
        setWithdrawalState(telegramId, 'awaiting_custom_amount', { currency: currency as 'SOL' | 'USDC' | 'USDT' | 'ETH', chain: chain as 'SOLANA' | 'EVM' });

        let minAmount = "";
        let example = "";
        if (currency === "SOL") {
            minAmount = "0.01 SOL";
            example = "0.5";
        } else if (currency === "ETH") {
            minAmount = "0.001 ETH";
            example = "0.01";
        } else {
            minAmount = `1 ${currency}`;
            example = "10";
        }

        await ctx.answerCbQuery();
        await ctx.reply(`Please enter the amount of ${currency} you want to withdraw.\n\n⚠️ Minimum: ${minAmount}\n\nExample: ${example}`);
    }

    static async handleCustomAmountInput(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        const message = (ctx.message as any)?.text;

        if (!userId || !message) {
            return;
        }

        const state = getWithdrawalState(userId);
        if (!state || state.step !== 'awaiting_custom_amount' || !state.data.currency) {
            return;
        }

        const enteredAmount = message.trim();
        const amount = parseFloat(enteredAmount);

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("❌ Invalid amount. Please enter a positive number (e.g., 0.5, 10, 100):");
            return;
        }

        const currency = state.data.currency;

        // Validate minimum withdrawal amounts
        if (currency === "SOL" && amount < 0.01) {
            await ctx.reply("❌ Minimum withdrawal amount for SOL is 0.01 SOL. Please enter a valid amount:");
            return;
        } else if (currency === "ETH" && amount < 0.001) {
            await ctx.reply("❌ Minimum withdrawal amount for ETH is 0.001 ETH. Please enter a valid amount:");
            return;
        } else if ((currency === "USDC" || currency === "USDT") && amount < 1) {
            await ctx.reply(`❌ Minimum withdrawal amount for ${currency} is 1 ${currency}. Please enter a valid amount:`);
            return;
        }
        const rateUrl = config.paymentRateUrl;

        if (!rateUrl) {
            await ctx.reply("Exchange URL not specified");
            clearWithdrawalState(userId);
            return;
        }

        const exchangeRate = await fetch(rateUrl);
        const rate = await exchangeRate.json();

        // Calculate NGN amount based on currency
        let amtToReceive = "";
        if (currency === "SOL") {
            amtToReceive = (amount * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2);
        } else if (currency === "ETH") {
            // rate.data.sell.ETH is ETH per USD, so invert to get USD per ETH
            const usdPerEth = rate.data.sell.ETH ? (1 / rate.data.sell.ETH) : 3361.13;
            amtToReceive = (amount * usdPerEth * rate.data.sell.NGN).toFixed(2);
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            amtToReceive = (amount * rate.data.sell.NGN).toFixed(2);
        }

        // Clear the awaiting_custom_amount state
        clearWithdrawalState(userId);

        const chain = state.data.chain || 'SOLANA';
        const confirmationMessage = `Are you sure you want to withdraw ${amount} ${currency} to your bank account?
You will get ₦${amtToReceive} once your withdrawal is confirmed.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Accept", `withdraw_confirm:${currency}:${amount}:${chain}`),
                Markup.button.callback("❌ Decline", "delete_message"),
            ],
        ]);

        await ctx.reply(confirmationMessage, keyboard);
    }

    static async handleWithdrawAmount(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_amount:CURRENCY:AMOUNT:CHAIN
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, USDT, or ETH
        const amount = parts[2];
        const chain = parts[3] || 'SOLANA'; // SOLANA or EVM
        const amountNum = parseFloat(amount);

        // Validate minimum withdrawal amounts
        if (currency === "SOL" && amountNum < 0.01) {
            await ctx.answerCbQuery("❌ Minimum withdrawal: 0.01 SOL");
            await ctx.reply("❌ Minimum withdrawal amount for SOL is 0.01 SOL. Please select a valid amount.");
            return;
        } else if (currency === "ETH" && amountNum < 0.001) {
            await ctx.answerCbQuery("❌ Minimum withdrawal: 0.001 ETH");
            await ctx.reply("❌ Minimum withdrawal amount for ETH is 0.001 ETH. Please select a valid amount.");
            return;
        } else if ((currency === "USDC" || currency === "USDT") && amountNum < 2.5) {
            await ctx.answerCbQuery(`❌ Minimum withdrawal is 2.5${currency}`);
            await ctx.reply(`❌ Minimum withdrawal amount is 2.5 ${currency}.`);
            return;
        }

        const rateUrl = config.paymentRateUrl;

        if (!rateUrl) {
            await ctx.reply("Exchange URL not specified");
            return;
        }
        const exchangeRate = await fetch(rateUrl);
        const rate = await exchangeRate.json();

        // Calculate NGN amount based on currency
        let amtToReceive = "";
        if (currency === "SOL") {
            amtToReceive = (parseFloat(amount) * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2);
        } else if (currency === "ETH") {
            const ethToUsd = rate.data.sell.ETH || 3361.13;
            amtToReceive = (parseFloat(amount) * ethToUsd * rate.data.sell.NGN).toFixed(2);
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            amtToReceive = (parseFloat(amount) * rate.data.sell.NGN).toFixed(2);
        }

        const message = `Are you sure you want to withdraw ${amount} ${currency} to your bank account?
You will get ₦${amtToReceive} once your withdrawal is confirmed.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Accept", `withdraw_confirm:${currency}:${amount}:${chain}`),
                Markup.button.callback("❌ Decline", "delete_message"),
            ],
        ]);

        const response = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, response.message_id);
    }

    static async handleWithdrawConfirmation(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_confirm:CURRENCY:AMOUNT:CHAIN
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, USDT, or ETH
        const amount = parts[2];
        const chain = parts[3] || 'SOLANA'; // SOLANA or EVM

        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
        console.log("attempting withdrawal: ", { telegramId, currency, amount, chain });

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }
        setWithdrawalState(telegramId, 'awaiting_pin', { amount, currency: currency as 'SOL' | 'USDC' | 'USDT' | 'ETH', chain: chain as 'SOLANA' | 'EVM' });

        const user = await getUser(telegramId, username);
        if (!user) {
            await ctx.reply("❌ User does not exist.");
            return;
        } else if (!user.bank_details.account_number || !user.bank_details.bank_code) {
            await ctx.reply("❌ Please setup a payment method first.");
            return;
        } else if (!user.bank_details.withdrawalPin) {
            await ctx.reply("❌ Please setup a withdrawal pin first.");
            return;
        } else if (!config.yaraApiKey) {
            await ctx.reply("❌ Developement error");
            return;
        }

        //ask the user to enter their withdrawal pin
        await ctx.reply(`Please enter your 4-digit withdrawal pin to withdraw ${amount} ${currency}:`);
        return;
    }
    static async handleWithdrawPinVerification(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        const message = (ctx.message as any)?.text;

        if (!userId || !message) {
            return;
        }

        const state = getWithdrawalState(userId);
        if (!state || state.step !== 'awaiting_pin') {
            return;
        }

        const enteredPin = message.trim();

        // Validate pin format
        if (!/^\d{4}$/.test(enteredPin)) {
            await ctx.reply("❌ Invalid pin format. Please enter a 4-digit numeric pin.");
            return;
        }

        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";
        const user = await getUser(userId, username);

        if (!user) {
            await ctx.reply("❌ User does not exist.");
            clearWithdrawalState(userId);
            return;
        }

        // Verify pin matches
        if (user.bank_details.withdrawalPin !== parseInt(enteredPin, 10)) {
            await ctx.reply("❌ Incorrect withdrawal pin. Please try again:");
            return; // Keep state active for retry
        }

        // Pin is correct, proceed with withdrawal
        const { amount, currency, chain } = state.data;
        clearWithdrawalState(userId);

        if (!currency) {
            await ctx.reply("❌ Currency not specified. Please try again.");
            return;
        }

        console.log(`Processing withdrawal: ${amount} ${currency} on ${chain} chain`);

        //create a payment widget with the user details and account number
        const widget = config.paymentWidgetUrl;
        if (!widget) {
            await ctx.reply("Payment widget URL not specified");
            return;
        }
        const paymentOptions = {
            "sender": {},
            "recipient": {
                "firstName": user.telegram_id.toString(),
                "lastName": user.username,
                "email": "dev.czdamian@gmail.com",
                "phoneNumber": "+2348060864466",
                "bankAccount": {
                    "accountNumber": user.bank_details.account_number,
                    "bankCode": user.bank_details.bank_code
                },
                "address": "Jumpabot",
                "city": "Jumpabot",
                "country": "Jumpabot"
            },
            "amount": Number(amount),
            "paymentRemarks": "thanks",
            "fromCurrency": currency,
            "payoutCurrency": "NGN",
            "publicKey": "pk_test_GIST",
            "developerFee": "0.5", //platform charges for each withdrawal in string
            "payoutType": "DIRECT_DEPOSIT"
        };
        console.log("payment options: ", paymentOptions)

        try {

            const getPaymentWidget = await fetch(widget, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-yara-public-key": config.yaraApiKey,
                    "Accept": "application/json"
                },
                body: JSON.stringify(paymentOptions),
            });

            if (!getPaymentWidget.ok) {
                const errorText = await getPaymentWidget.text();
                throw new Error(`Payment widget API error: ${getPaymentWidget.status} - ${errorText}`);
            }

            const paymentWidget = await getPaymentWidget.json();
            console.log("payment widget generated: ", paymentWidget)

            if (paymentWidget.error) {
                await ctx.reply(`❌ Withdrawal of ${amount} ${currency} failed.`);
                return;

            } else {
                const solAddress = paymentWidget.data.solAddress;
                const ethAddress = paymentWidget.data.ethAddress;
                const depositAmount = paymentWidget.data.depositAmount;
                const fiatPayoutAmount = paymentWidget.data.fiatPayoutAmount;

                // Determine recipient address based on chain
                const recipientAddress = chain === 'EVM' ? ethAddress : solAddress;
                console.log(`Recipient address (${chain}): ${recipientAddress}`);

                const saveTxtoDb = await Withdrawal.create({
                    telegram_id: ctx.from?.id,
                    transaction_id: paymentWidget.data.id,
                    fiatPayoutAmount: fiatPayoutAmount,
                    depositAmount: depositAmount,
                    yaraSolAddress: recipientAddress
                })
                console.log("withdrawal saved to db: ", saveTxtoDb)

                // Use the appropriate withdrawal function based on currency and chain
                let initTx;
                if (chain === 'SOLANA') {
                    if (currency === 'SOL') {
                        initTx = await WithdrawSolToNgn(ctx, recipientAddress, depositAmount);
                    } else if (currency === 'USDC') {
                        initTx = await WithdrawUSDCToNgn(ctx, recipientAddress, depositAmount);
                    } else if (currency === 'USDT') {
                        initTx = await WithdrawUSDTToNgn(ctx, recipientAddress, depositAmount);
                    } else {
                        await ctx.reply(`❌ Unsupported Solana currency: ${currency}`);
                        return;
                    }
                } else if (chain === 'EVM') {
                    if (currency === 'ETH') {
                        initTx = await withdrawETHToNGN(ctx, recipientAddress, depositAmount);
                    } else if (currency === 'USDC') {
                        initTx = await withdrawUSDCToNGNEVM(ctx, recipientAddress, depositAmount);
                    } else if (currency === 'USDT') {
                        initTx = await withdrawUSDTToNGNEVM(ctx, recipientAddress, depositAmount);
                    } else {
                        await ctx.reply(`❌ Unsupported EVM currency: ${currency}`);
                        return;
                    }
                } else {
                    await ctx.reply(`❌ Unsupported chain: ${chain}`);
                    return;
                }

                console.log("init tx result:", initTx);

                if (initTx.success) {
                    await ctx.reply(`✅ Withdrawal of ${depositAmount} ${currency} was successful. ₦${fiatPayoutAmount} will be added to your account shortly.`);
                    return;
                } else {
                    await ctx.reply(`❌ Withdrawal of ${depositAmount} ${currency} failed. ${initTx.error}`);
                    return;
                }

            }

        } catch (error) {
            console.error("Withdrawal error:", {
                error: error.message,
                stack: error.stack,
                response: error.response ? await error.response.text() : null
            });
            await ctx.reply(`❌ Server error: ${error.message}`);
            return;
        }
    }


    static async handleRefreshBalance(ctx: Context): Promise<void> {
        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        await ctx.answerCbQuery("🔄 Refreshing balances...");

        try {
            // Delete the old message
            await ctx.deleteMessage();
        } catch (error) {
            console.log("Could not delete message:", error);
        }

        const user = await getUser(telegramId, username);
        if (!user) {
            await ctx.reply("❌ User not found.");
            return;
        }

        try {
            // Import necessary utilities
            const getBalance = (await import("@shared/utils/getBalance")).default;
            const { getAllTokenBalances } = await import("@shared/utils/getTokenBalances");

            // Refresh all Solana wallet balances (respects cache if not expired)
            for (let i = 0; i < user.solanaWallets.length; i++) {
                const wallet = user.solanaWallets[i];

                try {
                    // Fetch SOL balance (respects cache if not expired)
                    await getBalance(wallet.address);

                    // Fetch token balances (respects cache if not expired)
                    await getAllTokenBalances(wallet.address);
                } catch (walletError) {
                    console.error(`Error refreshing wallet ${i}:`, walletError);
                    // Continue with cached values for this wallet
                }
            }

            // After refreshing, delegate to WalletViewHandlers to display the wallet view
            await WalletViewHandlers.handleViewWallet(ctx);
        } catch (error) {
            console.error("Refresh balance error:", error);
            await ctx.reply("❌ Failed to refresh balances. Please try again later.");
        }
    }

    static async handleShowPrivatexKey(ctx: Context): Promise<void> { }
    static async handleWalletDetails(ctx: Context): Promise<void> { }
    static async handleCloseWallet(ctx: Context): Promise<void> { }
}
