interface UserActionState {
  action: 'awaiting_custom_buy_amount' | 'awaiting_export_pin' | 'awaiting_import_private_key' | 'awaiting_add_solana_private_key' | 'awaiting_add_evm_private_key';
  tradeId?: string;
}

const userActionState = new Map<number, UserActionState>(); // Keyed by user's Telegram ID

export function setUserActionState(userId: number, state: UserActionState) {
  userActionState.set(userId, state);
}

export function getUserActionState(userId: number): UserActionState | undefined {
  return userActionState.get(userId);
}

export function clearUserActionState(userId: number) {
  userActionState.delete(userId);
}
