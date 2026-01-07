export interface DepositState {
  step: 'awaiting_amount';
  data: {
    asset?: 'base:usdc' | 'solana:usdc' | 'solana:usdt';
    amount?: number;
  };
}

const depositState = new Map<number, DepositState>();

export function setDepositState(
  userId: number,
  step: DepositState['step'],
  data: DepositState['data'] = {}
) {
  depositState.set(userId, { step, data });
}

export function getDepositState(userId: number): DepositState | undefined {
  return depositState.get(userId);
}

export function clearDepositState(userId: number) {
  depositState.delete(userId);
}
