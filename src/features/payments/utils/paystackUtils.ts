
import { paystackBanks } from "@src/features/payments/utils/paystackBankCodes";

/**
 * Find Paystack bank code by bank name (fuzzy matching)
 * @param bankName - Bank name to search for
 * @returns Bank code or null if not found
 */
export function findPaystackBankCode(bankName: string): string | null {
  const searchTerm = bankName.toLowerCase().trim();

  // Exact match first
  const exactMatch = paystackBanks.find(
    (bank) => bank.name.toLowerCase() === searchTerm
  );
  if (exactMatch) return exactMatch.code;

  // Partial match (contains)
  const partialMatch = paystackBanks.find((bank) =>
    bank.name.toLowerCase().includes(searchTerm)
  );
  if (partialMatch) return partialMatch.code;

  // Reverse partial match (search term contains bank name)
  const reverseMatch = paystackBanks.find((bank) =>
    searchTerm.includes(bank.name.toLowerCase())
  );
  if (reverseMatch) return reverseMatch.code;

  // Common abbreviations and aliases
  const aliases: { [key: string]: string } = {
    "gt bank": "Guaranty Trust Bank",
    "gtb": "Guaranty Trust Bank",
    "gtbank": "Guaranty Trust Bank",
    "guaranty": "Guaranty Trust Bank",
    "uba": "United Bank for Africa",
    "fcmb": "First City Monument Bank",
    "first bank": "First Bank of Nigeria",
    "zenith": "Zenith Bank PLC", // Verify Paystack name if possible, usually just Zenith Bank
    "access": "Access Bank",
    "union": "Union Bank PLC", // Verify Paystack name
    "eco bank": "Ecobank Nigeria",
    "ecobank": "Ecobank Nigeria",
    "fidelity": "Fidelity Bank",
    "stanbic": "Stanbic IBTC Bank",
    "wema": "ALAT by WEMA", // Or Wema Bank
    "polaris": "Polaris Bank",
    "keystone": "Keystone Bank",
    "sterling": "Sterling Bank",
    "providus": "Providus Bank",
    "unity": "Unity Bank PLC", // Verify Paystack name
    "jaiz": "Jaiz Bank",
    "titan": "Titan Bank",
    "moniepoint": "Moniepoint MFB",
    "opay": "OPay Digital Services Limited (OPay)",
    "paycom": "OPay Digital Services Limited (OPay)",
    "kuda": "Kuda Bank",
    "palmpay": "PalmPay",
    "palm pay": "PalmPay",
  };

  const aliasMatch = aliases[searchTerm];
  if (aliasMatch) {
    const bank = paystackBanks.find(
      (b) => b.name.toLowerCase() === aliasMatch.toLowerCase()
    );
    if (bank) return bank.code;
  }

  return null;
}
