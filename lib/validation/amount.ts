/**
 * Amount validation helper for VAL-209
 *
 * Validates and normalizes monetary amounts, rejecting inputs with unnecessary leading zeros
 */

export interface AmountValidationResult {
  isValid: boolean;
  normalized?: number;
  formatted?: string;
  error?: string;
}

export function validateAmount(amount: any): AmountValidationResult {
  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return {
      isValid: false,
      error: "Amount is required"
    };
  }

  // Convert to string and trim whitespace
  const amountStr = String(amount).trim();

  // Check for empty string
  if (amountStr === '') {
    return {
      isValid: false,
      error: "Amount is required"
    };
  }

  // Check for negative amounts
  if (amountStr.startsWith('-')) {
    return {
      isValid: false,
      error: "Amount must be positive"
    };
  }

  // Check for currency symbols or commas
  if (/[$€£¥,]/.test(amountStr)) {
    return {
      isValid: false,
      error: "Amount should not include currency symbols or commas"
    };
  }

  // Check for non-numeric characters (except decimal point)
  if (!/^\d+(\.\d+)?$/.test(amountStr)) {
    return {
      isValid: false,
      error: "Amount must contain only numeric characters"
    };
  }

  // Check for leading zeros (except "0" or "0.x")
  // This regex matches amounts with unnecessary leading zeros
  if (/^0[0-9]/.test(amountStr)) {
    return {
      isValid: false,
      error: "Amount should not have unnecessary leading zeros (use '0.50' instead of '00.50')"
    };
  }

  // Check for multiple zeros
  if (/^00+/.test(amountStr)) {
    return {
      isValid: false,
      error: "Amount should not have unnecessary leading zeros"
    };
  }

  // Check decimal places (max 2)
  const decimalMatch = amountStr.match(/\.(\d+)$/);
  if (decimalMatch && decimalMatch[1].length > 2) {
    // Check if it's also below minimum to provide appropriate error
    const parsed = parseFloat(amountStr);
    if (parsed < 0.01) {
      // Mention both issues - minimum $0.01 and decimal places
      return {
        isValid: false,
        error: "Amount must be at least $0.01 and can have at most 2 decimal places"
      };
    }
    return {
      isValid: false,
      error: "Amount can have at most 2 decimal places"
    };
  }

  // Parse the amount
  const parsed = parseFloat(amountStr);

  // Check for valid number
  if (isNaN(parsed) || !isFinite(parsed)) {
    return {
      isValid: false,
      error: "Invalid amount format"
    };
  }

  // Check minimum amount
  if (parsed < 0.01) {
    return {
      isValid: false,
      error: "Amount must be at least $0.01 (minimum)"
    };
  }

  // Check maximum amount
  if (parsed > 10000.00) {
    return {
      isValid: false,
      error: "Amount cannot exceed $10,000.00 (maximum)"
    };
  }

  // Format the amount to 2 decimal places
  const formatted = parsed.toFixed(2);

  return {
    isValid: true,
    normalized: parsed,
    formatted: formatted
  };
}