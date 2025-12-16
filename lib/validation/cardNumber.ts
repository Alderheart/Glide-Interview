/**
 * Card number validation utilities
 * Implements Luhn algorithm and card type detection
 */

/**
 * Validates a credit/debit card number using the Luhn algorithm
 * @param cardNumber - The card number to validate (digits only)
 * @returns true if the card number passes Luhn check
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Card type patterns for validation
 */
export const CARD_PATTERNS = {
  visa: /^4\d{15}$/,
  mastercard: /^(5[1-5]\d{14}|2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)\d{12})$/,
  amex: /^3[47]\d{13}$/,
  // Updated to include UnionPay co-branded (622126-622925) and additional ranges (6282-6288)
  discover: /^(6011\d{12}|(644|645|646|647|648|649)\d{13}|65\d{14}|622(12[6-9]|1[3-9]\d|[2-8]\d{2}|9[01]\d|92[0-5])\d{10}|628[2-8]\d{12})$/,
};

/**
 * Detects card type from card number
 * @param cardNumber - The card number to check
 * @returns Card type or null if not recognized
 */
export function detectCardType(cardNumber: string): string | null {
  const cleaned = cardNumber.replace(/\D/g, '');

  if (CARD_PATTERNS.visa.test(cleaned)) return 'Visa';
  if (CARD_PATTERNS.mastercard.test(cleaned)) return 'Mastercard';
  if (CARD_PATTERNS.amex.test(cleaned)) return 'American Express';
  if (CARD_PATTERNS.discover.test(cleaned)) return 'Discover';

  return null;
}

/**
 * Validates if card number matches accepted card types
 * @param cardNumber - The card number to validate
 * @returns true if card matches accepted patterns
 */
export function isAcceptedCardType(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\D/g, '');
  return !!(
    CARD_PATTERNS.visa.test(cleaned) ||
    CARD_PATTERNS.mastercard.test(cleaned) ||
    CARD_PATTERNS.amex.test(cleaned) ||
    CARD_PATTERNS.discover.test(cleaned)
  );
}

/**
 * Full card number validation
 * @param cardNumber - The card number to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateCardNumber(cardNumber: string): { valid: boolean; error?: string } {
  const cleaned = cardNumber.replace(/\D/g, '');

  // Check if only digits
  if (cardNumber !== cleaned) {
    return { valid: false, error: 'Card number must contain only digits' };
  }

  // Check length (15 for Amex, 16 for others)
  if (cleaned.length !== 15 && cleaned.length !== 16) {
    return { valid: false, error: 'Card number must be 15 or 16 digits' };
  }

  // Check if accepted card type
  if (!isAcceptedCardType(cleaned)) {
    return { valid: false, error: 'We accept Visa, Mastercard, American Express, and Discover cards' };
  }

  // Check Luhn algorithm
  if (!luhnCheck(cleaned)) {
    return { valid: false, error: 'Invalid card number. Please check and try again' };
  }

  return { valid: true };
}