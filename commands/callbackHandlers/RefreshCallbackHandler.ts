import { Context } from 'telegraf';
import { generateTokenInfoMessage } from '../../trading/DetectTokenAddress';

export async function handleRefresh(ctx: Context) {
  try {
    const callbackData = (ctx.callbackQuery as any).data;
    const contractAddress = callbackData.split(':')[1];

    if (!contractAddress) {
      await ctx.answerCbQuery('Error: Invalid refresh command.');
      return;
    }

    await ctx.answerCbQuery('Refreshing...');

    const { metricsMessage, keyboard } = await generateTokenInfoMessage(contractAddress);

    await ctx.editMessageText(metricsMessage, {
      parse_mode: 'HTML',
      ...keyboard,
    });

  } catch (error: any) {
    console.error('Error in handleRefresh:', error);
    await ctx.answerCbQuery(`Error: ${error.message || 'Could not refresh data.'}`);
  }
}
