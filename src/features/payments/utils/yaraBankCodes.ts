/**
 * Bank codes for Yara payment widget
 * These are different from Paystack bank codes
 */

export interface YaraBankCode {
  name: string;
  code: string;
}

export const yaraBankCodes: YaraBankCode[] = [
  { name: "Opay", code: "100004" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Access Bank", code: "044" },
  { name: "First Bank PLC", code: "011" },
  { name: "Zenith Bank PLC", code: "057" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Union Bank PLC", code: "032" },
  { name: "EcoBank PLC", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Wema Bank PLC", code: "035" },
  { name: "Polaris Bank", code: "076" },
  { name: "Keystone Bank", code: "082" },
  { name: "Sterling Bank PLC", code: "232" },
  { name: "ProvidusBank PLC", code: "101" },
  { name: "Kuda", code: "090267" },
  { name: "Moniepoint Microfinance Bank", code: "090405" },
  { name: "Paga", code: "327" },
  { name: "Unity Bank PLC", code: "215" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Titan Trust Bank", code: "000025" },
  { name: "AccessMobile", code: "100013" },
  { name: "GTBank (Guaranty) Mobile", code: "100009" },
  { name: "FCMB Easy Account", code: "100031" },
];

/**
 * Find Yara bank code by bank name (fuzzy matching)
 * @param bankName - Bank name to search for
 * @returns Bank code or null if not found
 */
export function findYaraBankCode(bankName: string): string | null {
  const searchTerm = bankName.toLowerCase().trim();

  // Exact match first
  const exactMatch = yaraBankCodes.find(
    (bank) => bank.name.toLowerCase() === searchTerm
  );
  if (exactMatch) return exactMatch.code;

  // Partial match (contains)
  const partialMatch = yaraBankCodes.find((bank) =>
    bank.name.toLowerCase().includes(searchTerm)
  );
  if (partialMatch) return partialMatch.code;

  // Reverse partial match (search term contains bank name)
  const reverseMatch = yaraBankCodes.find((bank) =>
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
    "fcmb": "First City Monument Bank (FCMB)",
    "first bank": "First Bank PLC",
    "zenith": "Zenith Bank PLC",
    "access": "Access Bank",
    "union": "Union Bank PLC",
    "eco bank": "EcoBank PLC",
    "ecobank": "EcoBank PLC",
    "fidelity": "Fidelity Bank",
    "stanbic": "Stanbic IBTC Bank",
    "wema": "Wema Bank PLC",
    "polaris": "Polaris Bank",
    "keystone": "Keystone Bank",
    "sterling": "Sterling Bank PLC",
    "providus": "ProvidusBank PLC",
    "unity": "Unity Bank PLC",
    "jaiz": "Jaiz Bank",
    "titan": "Titan Trust Bank",
    "moniepoint": "Moniepoint Microfinance Bank",
  };

  const aliasMatch = aliases[searchTerm];
  if (aliasMatch) {
    const bank = yaraBankCodes.find(
      (b) => b.name.toLowerCase() === aliasMatch.toLowerCase()
    );
    if (bank) return bank.code;
  }

  return null;
}
