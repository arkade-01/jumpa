/**
 * State management for AI-assisted withdrawal requests
 * Tracks incomplete withdrawal requests that need follow-up questions
 */

interface AIWithdrawalState {
  step: 'processing' | 'awaiting_bank_name' | 'awaiting_chain' | 'awaiting_currency' | 'awaiting_pin';
  lastUpdated: number; // For TTL
  data: {
    history?: { role: "user" | "assistant"; content: string }[]; // Conversation history
    amount?: number;          // NGN amount
    recipient?: string;       // Bank account number
    bankName?: string;       // Bank name (optional initially)
    bankCode?: string;       // Bank code from lookup
    accountName?: string;    // Validated account name from Paystack
    chain?: 'SOLANA' | 'BASE' | 'CELO';
    currency?: 'SOL' | 'USDC' | 'USDT' | 'ETH';
    cryptoAmount?: number;   // Calculated crypto amount
    yaraWalletAddress?: string; // Yara payment widget wallet address
    pinAttempts?: number;    // Number of failed PIN attempts
  };
}

// In-memory storage for withdrawal states (keyed by telegram user ID)
const aiWithdrawalStates = new Map<number, AIWithdrawalState>();

// Time-to-live for withdrawal sessions (15 minutes)
const STATE_TTL_MS = 15 * 60 * 1000;

/**
 * Set AI withdrawal state for a user
 */
export function setAIWithdrawalState(
  userId: number,
  step: AIWithdrawalState['step'],
  data: AIWithdrawalState['data']
): void {
  aiWithdrawalStates.set(userId, {
    step,
    data,
    lastUpdated: Date.now()
  });
  console.log(`[AI Withdrawal State] Set state for user ${userId}:`, { step, data });
}

/**
 * Get AI withdrawal state for a user
 * Checks for expiration and clears if TTL has passed
 */
export function getAIWithdrawalState(userId: number): AIWithdrawalState | undefined {
  const state = aiWithdrawalStates.get(userId);

  if (state) {
    const isExpired = Date.now() - state.lastUpdated > STATE_TTL_MS;
    if (isExpired) {
      console.log(`[AI Withdrawal State] State expired for user ${userId}. Clearing.`);
      clearAIWithdrawalState(userId);
      return undefined;
    }
  }

  return state;
}

/**
 * Clear AI withdrawal state for a user
 */
export function clearAIWithdrawalState(userId: number): void {
  aiWithdrawalStates.delete(userId);
  console.log(`[AI Withdrawal State] Cleared state for user ${userId}`);
}

/**
 * Update specific fields in AI withdrawal state
 */
export function updateAIWithdrawalState(
  userId: number,
  updates: Partial<AIWithdrawalState['data']>
): void {
  const currentState = aiWithdrawalStates.get(userId);
  if (currentState) {
    currentState.data = { ...currentState.data, ...updates };
    currentState.lastUpdated = Date.now(); // Reset TTL on update
    aiWithdrawalStates.set(userId, currentState);
    console.log(`[AI Withdrawal State] Updated state for user ${userId}:`, updates);
  }
}
