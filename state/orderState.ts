interface OrderState {
  transactionBase64: string;
  requestId: string;
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
