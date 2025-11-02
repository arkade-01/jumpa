import { Context } from 'telegraf';
import { setUserActionState } from '@shared/state/userActionState';

export async function handleBuyCustomAmountRequest(ctx: Context) {
  try {
    if (!ctx.from) {
      return ctx.reply('User not identified.');
    }

    const callbackData = (ctx.callbackQuery as any).data;
    const tradeId = callbackData.split(':')[1];

    if (!tradeId) {
      return ctx.answerCbQuery('Error: Invalid trade session.');
    }

    // Set the state for the user to indicate we are awaiting their custom amount
    setUserActionState(ctx.from.id, {
      action: 'awaiting_custom_buy_amount',
      tradeId: tradeId,
    });

    await ctx.answerCbQuery();
    await ctx.reply('Please enter the amount of SOL you wish to buy.');

  } catch (error) {
    console.error('Error in handleBuyCustomAmountRequest:', error);
    await ctx.reply('An unexpected error occurred.');
  }
}
