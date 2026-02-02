interface OrderState {
  transactionBase64: string;
  requestId: string;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  amountNative: number; // in lamports
  amountUsd: number;
  slippageBps: number;
  feeNative: number; // in lamports
  tokenAmount: number; // expected output amount
}

const orderState: Map<number, OrderState> = new Map();

export function setOrderState(userId: number, state: OrderState): void {
  orderState.set(userId, state);
}

export function getOrderState(userId: number): OrderState | undefined {
  return orderState.get(userId);
}

export function clearOrderState(userId: number): void {
  orderState.delete(userId);
}
