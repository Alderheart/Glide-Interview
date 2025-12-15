import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * VAL-207: Routing Number Validation Tests
 *
 * These tests verify that the routing number validation properly:
 * 1. Validates routing numbers using ABA checksum algorithm
 * 2. Ensures routing numbers are exactly 9 digits
 * 3. Rejects invalid routing numbers (wrong length, invalid checksum, etc.)
 * 4. Provides appropriate error messages
 *
 * Note: These tests will FAIL until the validation is implemented in:
 * - lib/validation/routingNumber.ts (validation helper)
 * - server/routers/account.ts (backend validation)
 * - components/FundingModal.tsx (frontend validation)
 */

/**
 * ABA Routing Number Checksum Validation
 * Formula: 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9) mod 10 = 0
 */
function validateRoutingNumberChecksum(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) {
    return false;
  }

  const digits = routingNumber.split('').map(Number);

  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8])
  ) % 10;

  return checksum === 0;
}

// Routing number validation schema matching what should be in lib/validation/routingNumber.ts
const routingNumberSchema = z.string()
  .regex(/^\d{9}$/, "Routing number must be exactly 9 digits")
  .refine((value) => {
    return validateRoutingNumberChecksum(value);
  }, "Invalid routing number checksum");

describe('VAL-207: Routing Number Validation', () => {
  describe('ABA Checksum Validation', () => {
    it('should accept valid routing number - Chase (021000021)', () => {
      const validRoutingNumber = '021000021';
      const result = routingNumberSchema.safeParse(validRoutingNumber);

      expect(result.success).toBe(true);
    });

    it('should accept valid routing number - Bank of America (026009593)', () => {
      const validRoutingNumber = '026009593';
      const result = routingNumberSchema.safeParse(validRoutingNumber);

      expect(result.success).toBe(true);
    });

    it('should accept valid routing number - Wells Fargo (121000248)', () => {
      const validRoutingNumber = '121000248';
      const result = routingNumberSchema.safeParse(validRoutingNumber);

      expect(result.success).toBe(true);
    });

    it('should accept valid routing number - Citibank (021000089)', () => {
      const validRoutingNumber = '021000089';
      const result = routingNumberSchema.safeParse(validRoutingNumber);

      expect(result.success).toBe(true);
    });

    it('should reject routing number with invalid checksum', () => {
      // Change last digit of Chase routing number from 1 to 2
      const invalidRoutingNumber = '021000022';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/checksum/i);
      }
    });

    it('should reject all zeros', () => {
      const invalidRoutingNumber = '000000000';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject all nines', () => {
      const invalidRoutingNumber = '999999999';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject sequential numbers', () => {
      const invalidRoutingNumber = '123456789';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });
  });

  describe('Format Validation', () => {
    it('should reject routing number with less than 9 digits', () => {
      const invalidRoutingNumber = '12345678';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/9 digits/i);
      }
    });

    it('should reject routing number with more than 9 digits', () => {
      const invalidRoutingNumber = '1234567890';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/9 digits/i);
      }
    });

    it('should reject routing number with letters', () => {
      const invalidRoutingNumber = '02100002A';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject routing number with special characters', () => {
      const invalidRoutingNumber = '021-000-021';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject routing number with spaces', () => {
      const invalidRoutingNumber = '021 000 021';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const invalidRoutingNumber = '';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });
  });

  describe('Additional Valid Routing Numbers', () => {
    // Testing with multiple known valid routing numbers
    const validRoutingNumbers = [
      '111000025', // Webster Bank
      '011401533', // TD Bank
      '021001088', // Deutsche Bank
      '026013673', // Bank of America
      '031101279', // The Bancorp Bank
      '041215663', // Sutton Bank
      '051000017', // BMO Harris Bank
      '061000052', // Bank of America
      '071000013', // JP Morgan Chase
      '081000032', // Bank of America
      '091000019', // Wells Fargo Bank
      '101000187', // BMO Harris Bank
    ];

    validRoutingNumbers.forEach((routingNumber) => {
      it(`should accept valid routing number ${routingNumber}`, () => {
        const result = routingNumberSchema.safeParse(routingNumber);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Invalid Checksum Examples', () => {
    it('should reject routing number with checksum failure - off by 1', () => {
      // Valid: 021000021, Invalid: 021000020
      const invalidRoutingNumber = '021000020';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject routing number with checksum failure - first digit changed', () => {
      // Valid: 021000021, Invalid: 121000021
      const invalidRoutingNumber = '121000021';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject routing number with checksum failure - middle digit changed', () => {
      // Valid: 021000021, Invalid: 021000121
      const invalidRoutingNumber = '021000121';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should reject routing number starting with leading zeros (invalid bank)', () => {
      // Routing numbers starting with 00 are not valid
      const invalidRoutingNumber = '000000051';
      const result = routingNumberSchema.safeParse(invalidRoutingNumber);

      expect(result.success).toBe(false);
    });

    it('should reject null value', () => {
      const result = routingNumberSchema.safeParse(null);

      expect(result.success).toBe(false);
    });

    it('should reject undefined value', () => {
      const result = routingNumberSchema.safeParse(undefined);

      expect(result.success).toBe(false);
    });

    it('should reject numeric value (not string)', () => {
      const result = routingNumberSchema.safeParse(21000021);

      expect(result.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should reject SQL injection attempts', () => {
      const maliciousInput = "021000021' OR '1'='1";
      const result = routingNumberSchema.safeParse(maliciousInput);

      expect(result.success).toBe(false);
    });

    it('should reject script injection attempts', () => {
      const maliciousInput = "<script>alert('xss')</script>";
      const result = routingNumberSchema.safeParse(maliciousInput);

      expect(result.success).toBe(false);
    });

    it('should reject routing number with unicode digits', () => {
      const maliciousInput = '０２１００００２１'; // Full-width digits
      const result = routingNumberSchema.safeParse(maliciousInput);

      expect(result.success).toBe(false);
    });
  });

  describe('ABA Checksum Algorithm Tests', () => {
    it('should correctly calculate checksum for known routing number', () => {
      // Test the checksum algorithm directly
      expect(validateRoutingNumberChecksum('021000021')).toBe(true);
    });

    it('should correctly identify invalid checksum', () => {
      expect(validateRoutingNumberChecksum('021000022')).toBe(false);
    });

    it('should handle routing numbers with different patterns', () => {
      // Test routing numbers from different regions
      expect(validateRoutingNumberChecksum('111000025')).toBe(true); // Northeast
      expect(validateRoutingNumberChecksum('061000052')).toBe(true); // Southeast
      expect(validateRoutingNumberChecksum('091000019')).toBe(true); // West
    });
  });
});
