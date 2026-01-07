
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./tools";

const apiKey = process.env.ANTHROPIC_API_KEY;

// Only initialize if key exists, otherwise we might want to handle gracefully in the app
// provided this is running in a server environment that has the env.
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `
You are a banking assistant for Jumpa. Your job is to facilitate withdrawals.

RESPONSE RULES:
- Be extremely concise
- NO explanations, NO reasoning, NO thinking out loud
- When asking for information, ask ONLY the question
- Example: Instead of "The address is EVM so I need to ask..." just say "Which network do you want to send to? (Base or Celo)"

SUPPORTED MODES:
1. **BANK TRANSFER**: User wants to send money to a Nigerian Bank Account.
   - Destination: Bank Name + Account Number.
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN).
   
2. **CRYPTO TRANSFER**: User wants to send crypto to an external wallet address.
   - Destination: Wallet Address.
   - Source: Crypto Chain + Currency (MUST match destination rules).
   - Amount: Naira (NGN). We will convert it.

SUPPORTED CHAINS: SOLANA, BASE, CELO
SUPPORTED CURRENCIES: SOL, USDC, USDT, ETH, CELO
- CELO token: Celo chain only, wallet-to-wallet only (not for bank withdrawals)

PARSING RULES:
- "10 USDT" -> Amount: 10, AmountCurrency: USDT. (NO CONVERSION).
- "10k" -> Amount: 10000, AmountCurrency: NGN. (Convert to Crypto).
- "5000" -> Amount: 5000, AmountCurrency: NGN.

CRITICAL RULES:
- **Detect Intent**: 
  - If user provides "Opay", "Kuda", "GTB", or 10-digit number -> **Bank Mode**.
  - If user provides "0x..." or Base58 address -> **Crypto Mode**.
- **EVM Addresses**: 
  - 0x addresses work on BOTH Base AND Celo
  - If user already said "base" or "celo" in their message, use that chain - DO NOT ask again
  - ONLY ask "Which network?" if user did NOT specify Base or Celo anywhere in their message
- **Solana**: Base58 addresses are always Solana (no ambiguity).
- **Crypto Validation**:
  - If providing a Wallet Address, call 'validate_wallet_address'.
  - Ensure Source Chain matches Address type (e.g. 0x... needs Base/Celo, not Solana).
- **Bank Validation**:
  - If providing Bank Details, call 'validate_withdrawal_details'.
- **Auto-Confirm**:
  - If ALL info is present and valid, call 'confirm_withdrawal'.

INTERACTION FLOWS:

[Bank Flow]
User: "Send 20k to Opay 8060864466 from my usdt on sol"
-> Validate Bank Details.
-> Confirm Withdrawal (Bank).

[Crypto Flow - Chain SPECIFIED in message]
User: "Send 5 USDT to 0x123... base"
-> User said "base" -> chain is BASE
-> Validate Wallet Address.
-> Confirm Withdrawal (chain: BASE, currency: USDT).

[Crypto Flow - Chain NOT specified]
User: "Send 4 USDT to 0x123..."
-> Validate Wallet Address.
-> address_type: "EVM" and user did NOT say base/celo
-> Response: "Which network do you want to send to? (Base or Celo)"

[Error]
User: "Send 20k to 0x123... on Solana"
-> Error: "Solana requires a Solana address, not 0x..."
`;

export interface AgentResponse {
  type: "text" | "confirmation" | "error";
  message?: string;
  data?: any;
  updatedHistory?: any[];
}

export async function processUserQuery(
  userId: number,
  userMessage: string,
  previousHistory: any[] = []
): Promise<AgentResponse> {
  if (!anthropic) {
    console.error("Anthropic API Key missing");
    return { type: "error", message: "AI Service Not Configured" };
  }

  // Input validation
  const MAX_MESSAGE_LENGTH = 300;
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return { type: "error", message: "Message too long. Please keep it under 300 characters." };
  }

  const BLOCKED_PATTERNS = [/\<script\>/i, /javascript:/i];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(userMessage)) {
      return { type: "error", message: "Invalid input." };
    }
  }

  try {
    const formattedTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    // Start with previous history and append the new user message
    let messages: any[] = [...previousHistory, { role: "user", content: userMessage }];

    // Run the loop (max 5 turns to prevent infinite loops)
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: formattedTools,
        messages: messages,
      });

      const stopReason = response.stop_reason;
      const content = response.content;

      // Append assistant's response to history
      messages.push({ role: "assistant", content: content });

      if (stopReason === "tool_use") {
        const toolResults = [];

        for (const block of content) {
          if (block.type === "tool_use") {
            const toolName = block.name;
            const toolInput = block.input;
            const toolId = block.id;

            console.log(`[AI Agent] Invoking tool: ${toolName}`, toolInput);

            if (toolName === "confirm_withdrawal") {
              // We are done!
              return {
                type: "confirmation",
                data: toolInput,
                updatedHistory: messages
              };
            }

            const toolDef = tools.find(t => t.name === toolName);
            if (toolDef) {
              try {
                const result = await toolDef.handler(toolInput as any);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolId,
                  content: JSON.stringify(result)
                });
              } catch (err: any) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolId,
                  content: JSON.stringify({ error: err.message }),
                  is_error: true
                });
              }
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolId,
                content: "Tool not found",
                is_error: true
              });
            }
          }
        }

        console.log(`[AI Agent] Tool Results:`, JSON.stringify(toolResults));
        messages.push({ role: "user", content: toolResults });

        // Continue loop to let Claude process tool results
      } else {
        // Text response (asking for more info or clarifying)
        const textBlock = content.find(c => c.type === "text");
        if (textBlock && textBlock.text) {
          return {
            type: "text",
            message: textBlock.text,
            updatedHistory: messages
          };
        }
        return { type: "error", message: "No response from AI" };
      }
    }

    return { type: "error", message: "Agent loop limit reached" };

  } catch (error: any) {
    console.error("[AI Agent] Process Error:", error);
    return { type: "error", message: "Sorry, I encountered an error processing your request." };
  }
}
