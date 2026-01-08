
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { MCPRegistry } from "@core/mcp/MCPRegistry";

const apiKey = process.env.ANTHROPIC_API_KEY;

// Only initialize if key exists, otherwise we might want to handle gracefully in the app
// provided this is running in a server environment that has the env.
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `
You are a banking assistant for Jumpa. Your job is to facilitate withdrawals and blockchain actions.

RESPONSE RULES:
- Be extremely concise
- NO explanations, NO reasoning, NO thinking out loud
- When asking for information, ask ONLY the question

SUPPORTED MODES:
1. **BANK TRANSFER**: User wants to send money to a Nigerian Bank Account.
   - Destination: Bank Name + Account Number.
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN).

2. **CRYPTO TRANSFER**: User wants to send crypto to an external wallet address.
   - Destination: Wallet Address.
   - Source: Crypto Chain + Currency.
   - Amount: Naira (NGN).

3. **AMADEUS ACTIONS**: General blockchain actions (send tokens, read state, claim testnet tokens) on Amadeus chain.
   - Use provided MCP tools.
   
   - **CRITICAL PROTOCOL FOR TRANSACTIONS**:
     A. Call tool to CREATE transaction (e.g. 'create_transaction').
     B. This tool will return a 'signing_payload' and 'blob'.
     C. STOP. Do NOT try to sign it yourself.
     D. Return the payload to the user by explicitly stating: "Transaction created. Please sign."
     E. Wait for user to provide signature.
     F. Once you receive signature + blob, call 'submit_transaction'.

   - **CRITICAL RULES FOR AMA TRANSFERS**:
     To transfer AMA tokens, use 'create_transaction' with these EXACT parameters:
     1. signer: the sender's address
     2. contract: "Coin" (exactly this string, NOT a hex address)
     3. function: "transfer"
     4. args: an array with exactly 3 elements:
        - [0]: {"b58": "RECIPIENT_ADDRESS"} (object with b58 key)
        - [1]: "AMOUNT_IN_BASE_UNITS" (string, e.g., "10000000000" for 10 AMA. 1 AMA = 1,000,000,000 base units)
        - [2]: "AMA" (the token symbol)
        
     Example: {"signer": "...", "contract": "Coin", "function": "transfer", "args": [{"b58":"RECIPIENT"},"10000000000","AMA"]}

     DO NOT set attached_symbol or attached_amount for standard transfers.

INTERACTION FLOWS:

[Amadeus Transfer]
User: "Send 10 AMA to [Address]"
-> Agent: Calls 'create_transaction' with EXACT parameters above (Coin, transfer, args)
-> Tool: Returns { signing_payload: "...", blob: "..." }
-> Agent: "Transaction ready. Please sign." (Stops)
-> User: (Signs via UI) -> Returns Signature
-> Agent: Calls 'submit_transaction'
-> Tool: Returns TxHash
-> Agent: "Success: [TxHash]"
`;

export interface AgentResponse {
  type: "text" | "confirmation" | "error" | "signature_request";
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
    // Dynamic Tool Loading
    const tools = await MCPRegistry.getInstance().getAllTools();

    // Start with previous history and append the new user message
    let messages: any[] = [...previousHistory, { role: "user", content: userMessage }];

    // Run the loop (max 5 turns to prevent infinite loops)
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Consider upgrading to Sonnet for complex tools if needed
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: tools,
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

            // 1. Handle Withdrawal Confirmation (Bank/Crypto)
            if (toolName === "confirm_withdrawal") {
              return {
                type: "confirmation",
                data: toolInput,
                updatedHistory: messages
              };
            }

            // 2. Execute Generic/MCP Tool
            try {
              const result = await MCPRegistry.getInstance().executeTool(toolName, toolInput);

              // 3. Handle Signature Request Interception
              // Check if result is standard MCP format with content list
              let signingData = result;

              // If result has content array, try to parse the first text block
              if (result && result.content && Array.isArray(result.content)) {
                const textBlock = result.content.find((c: any) => c.type === 'text');
                if (textBlock && textBlock.text) {
                  try {
                    const parsed = JSON.parse(textBlock.text);
                    if (parsed && parsed.signing_payload && parsed.blob) {
                      signingData = parsed;
                    }
                  } catch (e) {
                    // Not JSON, ignore
                  }
                }
              }

              // If the tool returns a signing payload (direct or parsed), we must pause and ask user to sign.
              if (signingData && signingData.signing_payload && signingData.blob) {
                return {
                  type: "signature_request",
                  data: {
                    toolName,
                    payload: signingData.signing_payload,
                    blob: signingData.blob,
                    rawResult: result
                  },
                  message: "Please sign this transaction to proceed.",
                  updatedHistory: messages
                };
              }

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
          }
        }

        console.log(`[AI Agent] Tool Results:`, JSON.stringify(toolResults));
        messages.push({ role: "user", content: toolResults });

        // Continue loop to let Claude process tool results
      } else {
        // Text response
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
