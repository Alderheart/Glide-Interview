/**
 * Phone number validation helper for VAL-204
 *
 * Standardizes on North American phone numbers (US/Canada)
 * - Accepts various input formats
 * - Normalizes to E.164 format (+1XXXXXXXXXX)
 * - Validates area code and exchange code rules
 * - Rejects international numbers outside North America
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

export function validatePhoneNumber(phoneNumber: any): PhoneValidationResult {
  // Handle null, undefined, or non-string inputs
  if (phoneNumber === null || phoneNumber === undefined) {
    return {
      isValid: false,
      error: "Phone number is required"
    };
  }

  // Convert to string if not already
  const phoneStr = String(phoneNumber).trim();

  // Check for empty string
  if (phoneStr.length === 0) {
    return {
      isValid: false,
      error: "Phone number is required"
    };
  }

  // Check for extremely long inputs (security)
  if (phoneStr.length > 50) {
    return {
      isValid: false,
      error: "Invalid phone number format"
    };
  }

  // Check for SQL injection or XSS attempts
  if (phoneStr.includes('<') || phoneStr.includes('>') || phoneStr.includes(';') || phoneStr.includes('--')) {
    return {
      isValid: false,
      error: "Invalid phone number format"
    };
  }

  // Check for invalid special characters (only allow +, -, (), ., and spaces)
  const allowedCharsPattern = /^[\d\s\-().+]+$/;
  if (!allowedCharsPattern.test(phoneStr)) {
    return {
      isValid: false,
      error: "Invalid phone number format. Only digits, spaces, and common separators are allowed."
    };
  }

  // Extract only digits from the input
  const digitsOnly = phoneStr.replace(/\D/g, '');

  // Check if input has at least some digits
  if (digitsOnly.length === 0) {
    return {
      isValid: false,
      error: "Phone number must contain digits"
    };
  }

  // Handle special short codes (911, 411, etc.)
  if (digitsOnly.length === 3) {
    return {
      isValid: false,
      error: "Emergency and service numbers are not valid phone numbers"
    };
  }

  // Remove leading 1 if present (North American country code)
  let nationalNumber = digitsOnly;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    nationalNumber = digitsOnly.substring(1);
  }

  // Check for exact 10 digits (North American format)
  if (nationalNumber.length !== 10) {
    return {
      isValid: false,
      error: "Phone number must be 10 digits. Only North American (US/Canada) phone numbers are accepted."
    };
  }

  // Check if it starts with country code other than 1 (international)
  if (digitsOnly.length > 11) {
    return {
      isValid: false,
      error: "Only North American (US/Canada) phone numbers are accepted"
    };
  }

  // Extract area code and exchange code
  const areaCode = nationalNumber.substring(0, 3);
  const exchangeCode = nationalNumber.substring(3, 6);
  const subscriberNumber = nationalNumber.substring(6, 10);

  // Validate area code
  const areaCodeFirst = areaCode[0];
  const areaCodeSecond = areaCode[1];

  // Area code cannot start with 0 or 1
  if (areaCodeFirst === '0' || areaCodeFirst === '1') {
    return {
      isValid: false,
      error: "Invalid area code. Area codes cannot start with 0 or 1."
    };
  }

  // N11 area codes are not valid (211, 311, 411, 511, 611, 711, 811, 911)
  if (areaCodeSecond === '1' && areaCode[2] === '1') {
    return {
      isValid: false,
      error: "Invalid area code. N11 codes are reserved for special services."
    };
  }

  // Check for toll-free area codes (not valid for user registration)
  const tollFreeAreaCodes = ['800', '833', '844', '855', '866', '877', '888'];
  if (tollFreeAreaCodes.includes(areaCode)) {
    return {
      isValid: false,
      error: "toll-free numbers are not valid for registration"
    };
  }

  // Check for premium rate area codes (900)
  if (areaCode === '900') {
    return {
      isValid: false,
      error: "premium rate numbers are not valid for registration"
    };
  }

  // Validate exchange code
  const exchangeFirst = exchangeCode[0];
  const exchangeSecond = exchangeCode[1];

  // Exchange code cannot start with 0 or 1
  if (exchangeFirst === '0' || exchangeFirst === '1') {
    return {
      isValid: false,
      error: "Invalid exchange code. Exchange codes cannot start with 0 or 1."
    };
  }

  // N11 exchange codes are not valid (except 555 which is allowed for fictional use)
  if (exchangeSecond === '1' && exchangeCode[2] === '1' && exchangeCode !== '555') {
    return {
      isValid: false,
      error: "Invalid exchange code. N11 codes are reserved for special services."
    };
  }

  // Check for all zeros or all ones
  if (nationalNumber === '0000000000' || nationalNumber === '1111111111') {
    return {
      isValid: false,
      error: "Invalid phone number"
    };
  }

  // Normalize to E.164 format (+1XXXXXXXXXX)
  const normalized = `+1${nationalNumber}`;

  return {
    isValid: true,
    normalized: normalized
  };
}

/**
 * Zod refinement helper for phone number validation
 * Use this in Zod schemas for consistent validation
 */
export function zodPhoneNumberValidator(phoneNumber: string) {
  const result = validatePhoneNumber(phoneNumber);
  return result.isValid;
}

/**
 * Get error message for phone number validation
 * Use this to get the specific error message for Zod schemas
 */
export function getPhoneNumberError(phoneNumber: string): string {
  const result = validatePhoneNumber(phoneNumber);
  return result.error || "Invalid phone number";
}
