/**
 * Amount validation helper for VAL-209
 *
 * This is a STUB implementation - tests will fail until properly implemented
 */

export interface AmountValidationResult {
  isValid: boolean;
  normalized?: number;
  formatted?: string;
  error?: string;
}

export function validateAmount(amount: any): AmountValidationResult {
  // STUB: This function needs to be implemented to fix VAL-209
  // For now, return a failure result to make tests fail meaningfully
  return {
    isValid: false,
    error: "STUB: Amount validation not yet implemented (VAL-209)"
  };
}