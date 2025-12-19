/**
 * State management for AI-assisted withdrawal requests
 * Tracks incomplete withdrawal requests that need follow-up questions
 */

interface AIWithdrawalState {
  step: 'awaiting_bank_name' | 'awaiting_chain' | 'awaiting_currency' | 'awaiting_pin';
  data: {
    amount: number;          // NGN amount
    recipient: string;       // Bank account number
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

/**
 * Set AI withdrawal state for a user
 */
export function setAIWithdrawalState(
  userId: number,
  step: AIWithdrawalState['step'],
  data: AIWithdrawalState['data']
): void {
  aiWithdrawalStates.set(userId, { step, data });
  console.log(`[AI Withdrawal State] Set state for user ${userId}:`, { step, data });
}

/**
 * Get AI withdrawal state for a user
 */
export function getAIWithdrawalState(userId: number): AIWithdrawalState | undefined {
  return aiWithdrawalStates.get(userId);
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
    aiWithdrawalStates.set(userId, currentState);
    console.log(`[AI Withdrawal State] Updated state for user ${userId}:`, updates);
  }
}
