// Add to state/bankState.ts or create state/withdrawalState.ts

interface WithdrawalState {
  step: 'awaiting_pin' | 'awaiting_custom_amount' | 'awaiting_dest_address' | 'awaiting_onchain_amount' | 'awaiting_onchain_pin';
  data: {
    amount?: string;
    currency?: 'SOL' | 'USDC' | 'USDT' | 'ETH';
    chain?: 'SOLANA' | 'BASE' | 'CELO';
    destination_address?: string;
  };
}

const withdrawalState = new Map<number, WithdrawalState>();

export function setWithdrawalState(userId: number, step: WithdrawalState['step'], data: WithdrawalState['data'] = {}) {
  withdrawalState.set(userId, { step, data });
}

export function getWithdrawalState(userId: number): WithdrawalState | undefined {
  return withdrawalState.get(userId);
}

export function clearWithdrawalState(userId: number) {
  withdrawalState.delete(userId);
}