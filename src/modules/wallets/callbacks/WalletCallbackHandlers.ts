import { Context, Markup } from "telegraf";
import getUser from "@modules/users/getUserInfo";
import { config } from "@core/config/config";
import Withdrawal from "@database/models/withdrawal";
import { WithdrawSolToNgn, WithdrawUSDCToNgn, WithdrawUSDTToNgn } from "@modules/payments/commands/WithdrawToNgn";
import { safeDeleteMessage } from "@shared/utils/messageUtils";
import { clearWithdrawalState, getWithdrawalState, setWithdrawalState } from "@shared/state/withdrawalState";

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
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("📋 Copy Address", "copy_address")],
        ]);

        await ctx.reply(message, { parse_mode: "Markdown", ...keyboard });
    }

    static async handleWithdraw(ctx: Context): Promise<void> {
        const keyboard = Markup.inlineKeyboard(
            [[
                Markup.button.callback("🏧To Bank Account", "withdraw_to_bank"),
                Markup.button.callback("on-chain", "withdraw_onchain"),
            ], [
                Markup.button.callback("Set Withdrawal Pin", "set_withdrawal_pin"),
                Markup.button.callback("❌ Cancel", "back_to_menu"),
            ],]
        );

        await ctx.reply("Where would you like to withdraw to? Make sure you have setup your withdrawal pin to avoid unauthorized withdrawals from your account", keyboard);
    }

    static async handleWithdrawOnchain(ctx: Context): Promise<void> {
        await ctx.reply("Coming soon!");
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
                Markup.button.callback("SOL (SOL)", "withdraw_currency:SOL"),
                Markup.button.callback("USDC (SOL)", "withdraw_currency:USDC"),
                Markup.button.callback("USDT (SOL)", "withdraw_currency:USDT"),
            ],[
                Markup.button.callback("ETH (EVM)", "withdraw_currency:ETH"),
                Markup.button.callback("USDC (EVM)", "withdraw_currency:USDC"),
                Markup.button.callback("USDT (EVM)", "withdraw_currency:USDT"),
            ],
            [
                Markup.button.callback("❌ Cancel", "withdraw_cancel"),
            ],
        ]);

        await ctx.reply(message, keyboard);
    }

    static async handleWithdrawCurrencySelection(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        const currency = cbData.split(":")[1]; // SOL, USDC, or USDT

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
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            const usdToNgn = rate.data.sell.NGN;
            rateMessage = `1 USD = ₦${usdToNgn.toFixed(2)}\n\n0.1 ${currency} = ₦${(0.1 * usdToNgn).toFixed(2)}\n0.2 ${currency} = ₦${(0.2 * usdToNgn).toFixed(2)}\n0.3 ${currency} = ₦${(0.3 * usdToNgn).toFixed(2)}`;
        }

        const message = `Your selected bank account:\n\nBank: ${user.bank_details.bank_name}\nAccount Name: ${user.bank_details.account_name}\nAccount Number: ${user.bank_details.account_number}\n\n📊 Current Exchange Rates:\n\n${rateMessage}\n\nRate expires in 30 seconds. Message auto deletes in 30 seconds`;

        // Create amount buttons based on currency
        const amountButtons = [];
        if (currency === "SOL") {
            amountButtons.push([
                Markup.button.callback("✏️ Custom Amount", `withdraw_custom_amount:${currency}`),
            ], [
                Markup.button.callback("0.1 SOL", `withdraw_amount:${currency}:0.1`),
                Markup.button.callback("0.5 SOL", `withdraw_amount:${currency}:0.5`),
                Markup.button.callback("1 SOL", `withdraw_amount:${currency}:1`),
            ]);
        } else {
            // For USDC and USDT, use different amounts (higher values since they're stablecoins)
            amountButtons.push([
                Markup.button.callback("✏️ Custom Amount", `withdraw_custom_amount:${currency}`),
            ], [
                Markup.button.callback("1 " + currency, `withdraw_amount:${currency}:1`),
                Markup.button.callback("5 " + currency, `withdraw_amount:${currency}:5`),
                Markup.button.callback("10 " + currency, `withdraw_amount:${currency}:10`),
                Markup.button.callback("20 " + currency, `withdraw_amount:${currency}:20`),
            ]);
        }

        const keyboard = Markup.inlineKeyboard([
            ...amountButtons,
            [
                Markup.button.callback("❌ Decline", "withdraw_cancel"),
            ],
        ]);

        const reply = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, reply.message_id);
    }

    static async handleWithdrawCustomAmount(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_custom_amount:CURRENCY
        const currency = cbData.split(":")[1]; // SOL, USDC, or USDT

        const telegramId = ctx.from?.id;

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        // Set state to await custom amount input
        setWithdrawalState(telegramId, 'awaiting_custom_amount', { currency: currency as 'SOL' | 'USDC' | 'USDT' });

        await ctx.answerCbQuery();
        await ctx.reply(`Please enter the amount of ${currency} you want to withdraw (e.g., 0.5, 10, 100):`);
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
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            amtToReceive = (amount * rate.data.sell.NGN).toFixed(2);
        }

        // Clear the awaiting_custom_amount state
        clearWithdrawalState(userId);

        const confirmationMessage = `Are you sure you want to withdraw ${amount} ${currency} to your bank account?
You will get ₦${amtToReceive} once your withdrawal is confirmed.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Accept", `withdraw_confirm:${currency}:${amount}`),
                Markup.button.callback("❌ Decline", "withdraw_cancel"),
            ],
        ]);

        await ctx.reply(confirmationMessage, keyboard);
    }

    static async handleWithdrawAmount(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_amount:CURRENCY:AMOUNT
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, or USDT
        const amount = parts[2];
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
        } else if (currency === "USDC" || currency === "USDT") {
            // USDC and USDT are typically 1:1 with USD
            amtToReceive = (parseFloat(amount) * rate.data.sell.NGN).toFixed(2);
        }

        const message = `Are you sure you want to withdraw ${amount} ${currency} to your bank account?
You will get ₦${amtToReceive} once your withdrawal is confirmed.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Accept", `withdraw_confirm:${currency}:${amount}`),
                Markup.button.callback("❌ Decline", "withdraw_cancel"),
            ],
        ]);

        const response = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, response.message_id);
    }

    static async handleWithdrawConfirmation(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        // Format: withdraw_confirm:CURRENCY:AMOUNT
        const parts = cbData.split(":");
        const currency = parts[1]; // SOL, USDC, or USDT
        const amount = parts[2];

        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }
        // <---------------SUSPEND FOR NOW ----------->
        await ctx.reply("🥺 withdrawal services are currently unavailable");
        return;
        setWithdrawalState(telegramId, 'awaiting_pin', { amount, currency: currency as 'SOL' | 'USDC' | 'USDT' });

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
        const { amount, currency } = state.data;
        clearWithdrawalState(userId);

        if (!currency) {
            await ctx.reply("❌ Currency not specified. Please try again.");
            return;
        }

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
                const tokenAddress = paymentWidget.data.ethAddress; //you can send usdt and usdc to this address (Solana address)
                const depositAmount = paymentWidget.data.depositAmount;
                const fiatPayoutAmount = paymentWidget.data.fiatPayoutAmount;

                // Determine which address to use based on currency
                const recipientAddress = currency === 'SOL' ? solAddress : tokenAddress;

                const saveTxtoDb = await Withdrawal.create({
                    telegram_id: ctx.from?.id,
                    transaction_id: paymentWidget.data.id,
                    fiatPayoutAmount: fiatPayoutAmount,
                    depositAmount: depositAmount,
                    yaraSolAddress: recipientAddress
                })
                console.log("withdrawal saved to db: ", saveTxtoDb)

                // Use the appropriate withdrawal function based on currency
                let initTx;
                if (currency === 'SOL') {
                    initTx = await WithdrawSolToNgn(ctx, recipientAddress, depositAmount);
                } else if (currency === 'USDC') {
                    initTx = await WithdrawUSDCToNgn(ctx, recipientAddress, depositAmount);
                } else if (currency === 'USDT') {
                    initTx = await WithdrawUSDTToNgn(ctx, recipientAddress, depositAmount);
                } else {
                    await ctx.reply(`❌ Unsupported currency: ${currency}`);
                    return;
                }

                console.log("init tx", initTx);

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


    static async handleRefreshBalance(ctx: Context): Promise<void> { }
    static async handleCopyAddress(ctx: Context): Promise<void> { }
    static async handleShowPrivatexKey(ctx: Context): Promise<void> { }
    static async handleWalletDetails(ctx: Context): Promise<void> { }
    static async handleCloseWallet(ctx: Context): Promise<void> { }
}
