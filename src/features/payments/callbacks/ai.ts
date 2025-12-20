import { GoogleGenAI } from '@google/genai';
import { config } from '@core/config/environment';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Detects withdrawal intent from user messages and extracts details
 * Supports multi-chain withdrawals with currency specification
 * @param message - User's natural language message
 * @returns Structured withdrawal data or null if detection fails
 */
export async function detectWithdrawalIntent(message: string): Promise<{
  isWithdrawal: boolean;
  amount?: number;
  currency?: string;
  chain?: string;
  recipient?: string;
  bankName?: string;
  cryptoAddress?: string;
} | null> {
  try {
    // Validate API key is configured
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }

    // Validate input
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this message and determine if it's a withdrawal/send money request: "${message}"`,
      config: {
        systemInstruction: `You are a withdrawal intent detector for Jumpa, a Telegram trading bot.

Your task is to analyze user messages and detect if they want to withdraw/send money from their wallet to a Nigerian bank account.

WITHDRAWAL PATTERNS TO DETECT:
- "send 2k to 8058509303 GT bank using USDT on solana"
- "withdraw 5000 to 0812345678 Access with ETH on base"
- "transfer 10k to 0909876543 Zenith using USDC on celo"
- "send 3k to 0801234567 UBA" (missing chain/currency - still valid)
- "pay 15000 to 0123456789 First Bank with SOL"

EXTRACT THE FOLLOWING:
1. **amount**: Convert to numeric NGN value
   - "2k" → 2000
   - "5m" → 5000000
   - "1.5k" → 1500
   - "10000" → 10000

2. **currency**: Normalize to standard format (or null if not specified)
   - "usdt", "tether" → "USDT"
   - "usdc", "usd coin" → "USDC"
   - "sol", "solana" → "SOL"
   - "eth", "ethereum" → "ETH"

3. **chain**: Normalize to standard format (or null if not specified)
   - "sol", "solana", "solana chain" → "SOLANA"
   - "base", "base chain", "base network" → "BASE"
   - "celo", "celo chain", "celo network" → "CELO"

4. **recipient**: Bank account number (10 digits typically)

5. **bankName**: Bank name (can be abbreviation like "GT bank", "UBA", "Access")

6. **cryptoAddress**: If sending to crypto address instead of bank (e.g., "send 5 SOL to 7xKXt..."), extract the address

NON-WITHDRAWAL MESSAGES (return isWithdrawal: false):
- General questions: "what is jumpa?", "how does this work?"
- Greetings: "hello", "hi", "good morning"
- Commands: "/start", "/help"
- Balance inquiries: "what's my balance?", "show my wallet"
- Any message not related to sending/withdrawing money

RESPONSE FORMAT (JSON only, no markdown):
{
  "isWithdrawal": true/false,
  "amount": number or null,
  "currency": "SOL" | "USDC" | "USDT" | "ETH" | null,
  "chain": "SOLANA" | "BASE" | "CELO" | null,
  "recipient": "string" or null,
  "bankName": "string" or null,
  "cryptoAddress": "string" or null
}

IMPORTANT:
- If chain or currency is not mentioned, set to null (we'll ask follow-up questions)
- Amount should always be in NGN (Nigerian Naira)
- Only respond with valid JSON, no explanations
- If not a withdrawal request, return {"isWithdrawal": false}`,
      }
    });

    // Extract and validate response text
    const responseText = response.text.trim();
    if (!responseText || responseText.length === 0) {
      throw new Error('Received empty response from AI');
    }

    console.log('[AI Withdrawal] Detection Response:', responseText);

    // Remove markdown code fences if present
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON response
    const result = JSON.parse(cleanedText);
    return result;
  } catch (error) {
    console.error('[AI Withdrawal] Error in detectWithdrawalIntent:', error);
    // Return null on error to silently ignore the message
    return null;
  }
}
