import { Context } from 'telegraf';
import { BaseCommand } from '@bot/commands/BaseCommand';
import { generateTransactionReceipt } from '@shared/utils/receiptGenerator';

export class ImageTestCommand extends BaseCommand {
  name = 'image';
  description = 'Test receipt image generation';

  async execute(ctx: Context): Promise<void> {
    try {
      await ctx.reply('Generating receipt image...');

      // Sample transaction data with bank details
      const receiptData = {
        amount: "₦50,000",
        currency: "USDT",
        timestamp: new Date(),
        network: "Solana",
        fee: "0.5",
        bankName: "GTBank",
        accountName: "John Doe",
        accountNumber: "0123456789",
        amountInCrypto: "1200"
      };

      // Generate the receipt image
      const imageBuffer = await generateTransactionReceipt(receiptData);

      // Send the image
      await ctx.replyWithPhoto(
        { source: imageBuffer },
        { caption: '✅ Your transaction receipt' }
      );
    } catch (error) {
      console.error('Error generating receipt:', error);
      await ctx.reply('Failed to generate receipt image. Please try again.');
    }
  }
}
