/**
 * Routing Number Validation Helper
 *
 * Validates ABA routing numbers using the checksum algorithm.
 * ABA routing numbers are 9-digit codes used to identify financial institutions in the US.
 *
 * Checksum Formula:
 * 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9) mod 10 = 0
 *
 * This prevents typos and ensures valid routing numbers for ACH transfers.
 */

/**
 * Validates ABA routing number using checksum algorithm
 * @param routingNumber - The routing number to validate
 * @returns boolean indicating if the checksum is valid
 */
export function validateRoutingNumberChecksum(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) {
    return false;
  }

  // Reject edge cases that are mathematically valid but not real routing numbers
  if (routingNumber === '000000000' || routingNumber === '999999999') {
    return false;
  }

  const digits = routingNumber.split('').map(Number);

  // ABA checksum calculation
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8])
  ) % 10;

  return checksum === 0;
}

/**
 * Comprehensive routing number validation
 * @param routingNumber - The routing number to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateRoutingNumber(routingNumber: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!routingNumber) {
    return { valid: false, error: 'Routing number is required for bank transfers' };
  }

  if (!/^\d{9}$/.test(routingNumber)) {
    return { valid: false, error: 'Routing number must be exactly 9 digits' };
  }

  if (!validateRoutingNumberChecksum(routingNumber)) {
    return { valid: false, error: 'Invalid routing number. Please check the number and try again' };
  }

  return { valid: true };
}

/**
 * Helper function for Zod validation
 * Can be used in .refine() for schema validation
 */
export function isValidRoutingNumber(routingNumber: string | undefined): boolean {
  return validateRoutingNumber(routingNumber).valid;
}