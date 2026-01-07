
import { findYaraBankCode } from "@features/payments/utils/yaraBankCodes";
import { findPaystackBankCode } from "@features/payments/utils/paystackUtils";
import { validateAccountNumber } from "@src/features/payments/utils/validateAccountNumber";
import { getCurrenciesForChain } from "@features/payments/utils/convertNGNToCrypto";

// Mocking function to get banks if not directly available, 
// but we might just trust the agent to fuzzy match or asking validation to handle it.
// For now, we rely on findYaraBankCode doing the heavy lifting during validation.

export const tools = [
  {
    name: "get_supported_chains_and_currencies",
    description: "Get the list of supported blockchains and their respective currencies.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
    handler: async () => {
      return {
        chains: [
          { name: "SOLANA", currencies: getCurrenciesForChain("SOLANA") },
          { name: "BASE", currencies: getCurrenciesForChain("BASE") },
          { name: "CELO", currencies: getCurrenciesForChain("CELO") },
        ],
      };
    },
  },
  {
    name: "validate_withdrawal_details",
    description: "Validate the DESTINATION bank account details. Ensure the bank matches the account name. Use this before asking for source of funds.",
    input_schema: {
      type: "object" as const,
      properties: {
        account_number: { type: "string", description: "The 10-digit destination bank account number" },
        bank_name: { type: "string", description: "The destination bank name (e.g. GTBank, Access Bank)" },
      },
      required: ["account_number", "bank_name"],
    },
    handler: async ({ account_number, bank_name }: { account_number: string, bank_name: string }) => {
      // 1. Find Yara Code (for execution)
      const yaraBankCode = findYaraBankCode(bank_name);

      // 2. Find Paystack Code (for validation)
      const paystackBankCode = findPaystackBankCode(bank_name);

      if (!yaraBankCode) {
        return {
          valid: false,
          error: "Bank not supported for withdrawal. Please check the bank name and try again.",
        };
      }

      if (!paystackBankCode) {
        // Fallback or warning? If we have Yara code but no Paystack code, 
        // we might not be able to validate name, but could potentially proceed.
        // For safety, let's require validation.
        return {
          valid: false,
          error: "Bank found but validation service is unavailable. Please check the spelling or try a major bank.",
        };
      }

      // 3. Validate using Paystack Code
      try {
        const validation = await validateAccountNumber(account_number, paystackBankCode);

        if (!validation || !validation.status || !validation.data) {
          return {
            valid: false,
            error: "That account number does not seem to match the bank. Please check details.",
          };
        }

        return {
          valid: true,
          account_name: validation.data.account_name,
          bank_code: yaraBankCode,
          bank_name_confirmed: bank_name,
        };
      } catch (err: any) {
        console.error("[Bank Validation] Paystack error:", err);
        return {
          valid: false,
          error: "Unable to validate account. Please try again.",
        };
      }
    },
  },
  {
    name: "validate_wallet_address",
    description: "Validate a crypto wallet address format. Returns address_type: 'SOLANA' or 'EVM'. For EVM addresses, you MUST ask the user which network (Base or Celo) before proceeding.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: { type: "string", description: "The crypto wallet address to validate." },
      },
      required: ["address"],
    },
    handler: async ({ address }: { address: string }) => {
      const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
      const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

      if (isSolanaAddress) {
        return {
          valid: true,
          address: address,
          address_type: "SOLANA",
          chain: "SOLANA",
        };
      }

      if (isEVMAddress) {
        return {
          valid: true,
          address: address,
          address_type: "EVM",
          // Chain must be determined from user context (Base or Celo)
        };
      }

      return {
        valid: false,
        error: "Invalid wallet address format.",
      };
    },
  },
  {
    name: "confirm_withdrawal",
    description: "Call this tool ONLY when ALL details are collected and validated. Use for EITHER Bank Withdrawal OR On-Chain Transfer.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: { type: "number", description: "The numeric value. E.g. 10 for '10 USDT'. Do NOT convert." },
        amount_currency: { type: "string", description: "The currency of the input amount. 'NGN' if implied, or the crypto ticker (e.g. 'USDC', 'USDT') if specified." },
        // Bank Details (Optional)
        account_number: { type: "string", description: "Bank Account Number (Required for Bank Transfer)" },
        bank_name: { type: "string", description: "Bank Name" },
        account_name: { type: "string", description: "Validated Account Name" },
        // Crypto Details (Optional)
        wallet_address: { type: "string", description: "Destination Wallet Address (Required for Crypto Transfer)" },

        // Common
        chain: { type: "string", enum: ["SOLANA", "BASE", "CELO"], description: "Source Chain" },
        currency: { type: "string", enum: ["SOL", "USDC", "USDT", "ETH", "CELO"], description: "Source Currency" },
      },
      // Note: We can't express "XOR" easily in JSON schema for OpenAI/Anthropic reliably, 
      // so we rely on the description and agent logic to enforce one set or the other.
      required: ["amount", "amount_currency", "chain", "currency"],
    },
    handler: async (args: any) => {
      // Validate supported currencies
      const SUPPORTED_CURRENCIES = ["SOL", "USDC", "USDT", "ETH", "CELO"];
      if (!SUPPORTED_CURRENCIES.includes(args.currency)) {
        throw new Error(`Invalid currency '${args.currency}'. Supported: ${SUPPORTED_CURRENCIES.join(", ")}. Ask user which currency to use.`);
      }

      // CELO token restrictions
      if (args.currency === 'CELO') {
        if (args.chain !== 'CELO') {
          throw new Error("CELO token is only available on Celo chain.");
        }
        if (!args.wallet_address) {
          throw new Error("CELO token is only supported for wallet-to-wallet transfers, not bank withdrawals.");
        }
      }

      // Validate that we have a destination
      if (!args.wallet_address && (!args.account_number || !args.bank_name)) {
        throw new Error("Missing destination: Provide either Wallet Address OR (Bank Name + Account Number).");
      }
      return {
        status: "confirmed",
        ...args
      };
    },
  },
];