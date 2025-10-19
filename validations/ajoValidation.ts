import { PublicKey } from "@solana/web3.js";

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ajo group creation parameters
 */
export function validateAjoCreation(params: {
  name: string;
  initial_capital: number;
  max_members: number;
  consensus_threshold?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!params.name || params.name.trim().length === 0) {
    errors.push("Group name is required");
  } else if (params.name.length > 100) {
    errors.push("Group name must be 100 characters or less");
  }

  // Validate initial capital
  if (params.initial_capital <= 0) {
    errors.push("Initial capital must be greater than 0");
  }

  // Validate max members
  if (params.max_members < 2) {
    errors.push("Maximum members must be at least 2");
  } else if (params.max_members > 100) {
    errors.push("Maximum members cannot exceed 100");
  }

  // Validate consensus threshold
  const consensus_threshold = params.consensus_threshold || 67;
  if (consensus_threshold < 50) {
    errors.push("Consensus threshold must be at least 50%");
  } else if (consensus_threshold > 100) {
    errors.push("Consensus threshold cannot exceed 100%");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate poll creation parameters
 */
export function validatePollCreation(params: {
  type: "trade" | "end_ajo";
  title: string;
  token_address?: string;
  token_symbol?: string;
  amount?: number;
  expires_hours?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate title
  if (!params.title || params.title.trim().length === 0) {
    errors.push("Poll title is required");
  } else if (params.title.length > 200) {
    errors.push("Poll title must be 200 characters or less");
  }

  // Validate trade-specific parameters
  if (params.type === "trade") {
    if (!params.token_address) {
      errors.push("Token address is required for trade polls");
    } else if (!isValidSolanaAddress(params.token_address)) {
      errors.push("Invalid token address format");
    }

    if (!params.token_symbol) {
      errors.push("Token symbol is required for trade polls");
    } else if (params.token_symbol.length > 20) {
      errors.push("Token symbol must be 20 characters or less");
    }

    if (!params.amount || params.amount <= 0) {
      errors.push("Trade amount must be positive");
    }
  }

  // Validate expiration hours
  if (params.expires_hours !== undefined) {
    if (params.expires_hours < 1) {
      errors.push("Expiration time must be at least 1 hour");
    } else if (params.expires_hours > 168) {
      // 1 week
      errors.push("Expiration time cannot exceed 168 hours (1 week)");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate vote parameters
 */
export function validateVote(params: { vote: boolean }): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Vote is a boolean, so it's always valid
  // But we can add additional validation here if needed

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate member contribution
 */
export function validateContribution(contribution: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (contribution < 0) {
    errors.push("Contribution must be non-negative");
  }

  // Add reasonable upper limit (e.g., 1 million SOL)
  if (contribution > 1000000) {
    errors.push("Contribution cannot exceed 1,000,000 SOL");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate group ID format
 */
export function validateGroupId(groupId: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!groupId || groupId.trim().length === 0) {
    errors.push("Group ID is required");
  }

  // Check if it's a valid MongoDB ObjectId format
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(groupId)) {
    errors.push("Invalid group ID format");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate poll ID format
 */
export function validatePollId(pollId: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pollId || pollId.trim().length === 0) {
    errors.push("Poll ID is required");
  }

  // Check if it's a valid MongoDB ObjectId format
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(pollId)) {
    errors.push("Invalid poll ID format");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate telegram user ID
 */
export function validateTelegramId(telegramId: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!telegramId || telegramId <= 0) {
    errors.push("Valid Telegram ID is required");
  }

  // Telegram IDs are typically 9-10 digits
  if (telegramId.toString().length < 5 || telegramId.toString().length > 12) {
    errors.push("Invalid Telegram ID format");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate chat ID
 */
export function validateChatId(chatId: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!chatId) {
    errors.push("Chat ID is required");
  }

  // Group chat IDs are negative, private chat IDs are positive
  // We'll accept both for now
  if (Math.abs(chatId).toString().length < 5) {
    errors.push("Invalid chat ID format");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (!input) return "";

  // Remove potentially dangerous characters
  let sanitized = input
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .trim();

  // Truncate if maxLength is specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and sanitize poll title
 */
export function validateAndSanitizeTitle(title: string): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    errors.push("Title is required");
    return { isValid: false, sanitized: "", errors };
  }

  const sanitized = sanitizeString(title, 200);

  if (sanitized.length === 0) {
    errors.push("Title contains only invalid characters");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}

/**
 * Validate and sanitize group name
 */
export function validateAndSanitizeGroupName(name: string): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push("Group name is required");
    return { isValid: false, sanitized: "", errors };
  }

  const sanitized = sanitizeString(name, 100);

  if (sanitized.length === 0) {
    errors.push("Group name contains only invalid characters");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}
