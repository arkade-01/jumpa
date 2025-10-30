interface UserActionState {
  action: 'awaiting_custom_buy_amount' | 'awaiting_export_pin';
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
