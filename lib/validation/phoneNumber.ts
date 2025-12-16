/**
 * Phone number validation helper for VAL-204
 *
 * This is a STUB implementation - tests will fail until properly implemented
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

export function validatePhoneNumber(phoneNumber: any): PhoneValidationResult {
  // STUB: This function needs to be implemented to fix VAL-204
  // For now, return a failure result to make tests fail meaningfully
  return {
    isValid: false,
    error: "STUB: Phone number validation not yet implemented (VAL-204)"
  };
}
