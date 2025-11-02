
interface TradeStateData {
  contractAddress: string;
  symbol: string;
  decimals: number;
}

const tradeState = new Map<string, TradeStateData>();
const TRADE_STATE_TTL = 15 * 60 * 1000; // 15 minutes

export function setTradeState(id: string, data: TradeStateData) {
  tradeState.set(id, data);
  setTimeout(() => {
    tradeState.delete(id);
  }, TRADE_STATE_TTL);
}

export function getTradeState(id: string): TradeStateData | undefined {
  return tradeState.get(id);
}

export function clearTradeState(id: string) {
  tradeState.delete(id);
}
