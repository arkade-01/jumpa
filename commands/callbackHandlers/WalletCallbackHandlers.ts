import { Context, Markup } from "telegraf";
import getUser from "../../services/getUserInfo";
import { config } from "../../config/config";
import Withdrawal from "../../models/withdrawal";
import { WithdrawSolToNgn } from "../WithdrawSolToNgn";
import { safeDeleteMessage } from "../../utils/messageUtils";

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

        const message = `Fund your wallet by sending SOL to your wallet address:\n\n\`${user.wallet_address}\``;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("📋 Copy Address", "copy_address")],
        ]);

        await ctx.reply(message, { parse_mode: "Markdown", ...keyboard });
    }

    static async handleWithdraw(ctx: Context): Promise<void> {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback("🏧To Bank Account", "withdraw_to_bank"),
            Markup.button.callback("on-chain", "withdraw_onchain"),
        ]);

        await ctx.reply("How would you like to withdraw?", keyboard);
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

        const rateUrl = config.paymentRateUrl

        if (!rateUrl) {
            await ctx.reply("Exchange URL not specified");
            return;
        }
        const exchangeRate = await fetch(rateUrl);
        const rate = await exchangeRate.json();

        const message = `Your selected bank account:\n\nBank: ${user.bank_details.bank_name}\nAccount Name: ${user.bank_details.account_name}\nAccount Number: ${user.bank_details.account_number}

        What rates do we use?

        1 USD = ₦${(rate.data.sell.NGN).toFixed(2)}
        
        0.1 SOL = ₦${(0.1 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}
        
        0.2 SOL = ₦${(0.2 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}
        
        0.3 SOL = ₦${(0.3 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)}

        Rate expires in 30 seconds. Message auto deletes in 30 seconds
        `;

        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("0.01 SOL", "withdraw_amount:0.01"),
                Markup.button.callback("0.02 SOL", "withdraw_amount:0.02"),
                Markup.button.callback("0.03 SOL", "withdraw_amount:0.03"),
                Markup.button.callback("0.05 SOL", "withdraw_amount:0.05"),
            ], [
                Markup.button.callback("0.1 SOL", "withdraw_amount:0.1"),
                Markup.button.callback("0.2 SOL", "withdraw_amount:0.2"),
                Markup.button.callback("0.3 SOL", "withdraw_amount:0.3"),
                Markup.button.callback("1 SOL", "withdraw_amount:1"),
            ],
            [
                Markup.button.callback("❌ Decline", "withdraw_cancel"),
            ],
        ]);

        const reply = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, reply.message_id);
    }

    static async handleWithdrawAmount(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        const amount = cbData.split(":")[1];
        const rateUrl = config.paymentRateUrl

        if (!rateUrl) {
            await ctx.reply("Exchange URL not specified");
            return;
        }
        const exchangeRate = await fetch(rateUrl);
        const rate = await exchangeRate.json();
        //convert selected SOL to ₦

        // 0.1 SOL = ₦${ (0.1 * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2) }

        const amtToReceive = (amount * (1 / rate.data.sell.SOL) * rate.data.sell.NGN).toFixed(2)


        const message = `Are you sure you want to withdraw ${amount} SOL to your bank account?
        You will get ₦${amtToReceive} once your withdrawal is confirmed.`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback("✅ Accept", `withdraw_confirm:${amount}`),
                Markup.button.callback("❌ Decline", "withdraw_cancel"),
            ],
        ]);

        const response = await ctx.reply(message, keyboard);

        // Schedule safe deletion of the message
        await safeDeleteMessage(ctx, response.message_id);
    }

    static async handleWithdrawConfirmation(ctx: Context): Promise<void> {
        const cbData = (ctx.callbackQuery as any).data;
        const amount = cbData.split(":")[1];

        //create a payment widget with the user details and account number
        const widget = config.paymentWidgetUrl;
        if (!widget) {
            await ctx.reply("Payment widget URL not specified");
            return;
        }
        const telegramId = ctx.from?.id;
        const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

        if (!telegramId) {
            await ctx.answerCbQuery("❌ Unable to identify your account.");
            return;
        }

        const user = await getUser(telegramId, username);
        if (!user) {
            await ctx.reply("❌ User does not exist.");
            return;
        } else if (!user.bank_details.account_number || !user.bank_details.bank_code) {
            await ctx.reply("❌ Please setup a payment method first.");
            return;
        } else if (!config.yaraApiKey) {
            await ctx.reply("❌ Developement error");
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
            "fromCurrency": "SOL",
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
                await ctx.reply(`❌ Withdrawal of ${amount} SOL failed.`);
                return;

            } else {
                //this is for solana only
                const solAddress = paymentWidget.data.solAddress;
                const depositAmount = paymentWidget.data.depositAmount;
                const fiatPayoutAmount = paymentWidget.data.fiatPayoutAmount;

                const saveTxtoDb = await Withdrawal.create({
                    telegram_id: ctx.from?.id,
                    transaction_id: paymentWidget.data.id,
                    fiatPayoutAmount: fiatPayoutAmount,
                    depositAmount: depositAmount,
                    yaraSolAddress: solAddress
                })
                console.log("withdrawal saved to db: ", saveTxtoDb)

                const initTx = await WithdrawSolToNgn(ctx, solAddress, depositAmount);
                console.log("init tx", initTx);

                if (initTx.success) {

                    await ctx.reply(`✅ Withdrawal of ${depositAmount} SOL was successful. ₦${fiatPayoutAmount} will be added to your account shortly.`);
                    return;
                } else {
                    await ctx.reply(`❌ Withdrawal of ${depositAmount} SOL failed. ${initTx.error}`);
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
