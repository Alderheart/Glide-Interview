/**
 * Test Suite for VAL-209: Amount Input Issues
 *
 * Bug: System accepts amounts with multiple leading zeros
 * - Frontend regex allows any number of leading zeros (00100, 00.50)
 * - This causes confusion in transaction records
 * - Amount parsing works correctly but display is confusing
 *
 * Solution: Validate amount format to reject unnecessary leading zeros
 * - Accept: "0", "0.50", "100", "100.50"
 * - Reject: "00", "01", "00100", "00.50"
 * - Ensure consistent validation between frontend and backend
 */

import { describe, expect, it } from "vitest";
import { validateAmount } from "@/lib/validation/amount";

describe('VAL-209: Amount Input Validation', () => {
  describe('Valid Amount Formats', () => {
    it('should accept single zero', () => {
      const result = validateAmount('0');
      expect(result.isValid).toBe(false); // Should be invalid (below minimum)
      expect(result.error).toContain('minimum');
    });

    it('should accept zero with decimal cents', () => {
      const result = validateAmount('0.01');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe(0.01);
    });

    it('should accept amounts without leading zeros', () => {
      const validAmounts = [
        { input: '1', expected: 1.00 },
        { input: '10', expected: 10.00 },
        { input: '100', expected: 100.00 },
        { input: '1000', expected: 1000.00 },
        { input: '10000', expected: 10000.00 },
      ];

      validAmounts.forEach(({ input, expected }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      });
    });

    it('should accept valid decimal amounts', () => {
      const validAmounts = [
        { input: '0.50', expected: 0.50 },
        { input: '1.99', expected: 1.99 },
        { input: '10.5', expected: 10.50 },
        { input: '100.25', expected: 100.25 },
        { input: '9999.99', expected: 9999.99 },
      ];

      validAmounts.forEach(({ input, expected }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      });
    });

    it('should accept maximum valid amount', () => {
      const result = validateAmount('10000.00');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe(10000.00);
    });
  });

  describe('Invalid Leading Zeros', () => {
    it('should reject double zero', () => {
      const result = validateAmount('00');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('leading zero');
    });

    it('should reject leading zero before non-zero digit', () => {
      const invalidAmounts = ['01', '09', '010', '0100', '01000'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('leading zero');
      });
    });

    it('should reject multiple leading zeros', () => {
      const invalidAmounts = [
        '000',
        '0000',
        '00100',
        '000100',
        '00001000',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('leading zero');
      });
    });

    it('should reject leading zeros with decimals', () => {
      const invalidAmounts = [
        '00.50',
        '01.50',
        '001.99',
        '0010.50',
        '00100.25',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('leading zero');
      });
    });
  });

  describe('Invalid Decimal Places', () => {
    it('should reject more than 2 decimal places', () => {
      const invalidAmounts = [
        '10.555',
        '100.999',
        '1.001',
        '0.0001',
        '99.12345',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('decimal');
      });
    });

    it('should reject invalid decimal formats', () => {
      const invalidAmounts = [
        '10.',
        '.50',
        '10..',
        '10.5.0',
        '10,50',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('Amount Range Validation', () => {
    it('should reject amounts below minimum', () => {
      const invalidAmounts = ['0', '0.00', '0.000', '0.0001'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('0.01');
      });
    });

    it('should reject amounts above maximum', () => {
      const invalidAmounts = [
        '10000.01',
        '10001',
        '15000',
        '99999',
        '1000000',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('10,000');
      });
    });
  });

  describe('Invalid Format Validation', () => {
    it('should reject non-numeric characters', () => {
      const invalidAmounts = [
        'abc',
        '10a',
        'a100',
        '100x50',
        '!@#',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('numeric');
      });
    });

    it('should reject currency symbols', () => {
      const invalidAmounts = ['$100', '€50', '£75', '¥1000'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should reject comma separators', () => {
      const invalidAmounts = ['1,000', '10,000', '1,000.50'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should reject empty or whitespace strings', () => {
      const invalidAmounts = ['', ' ', '  ', '\t', '\n'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('required');
      });
    });

    it('should reject negative amounts', () => {
      const invalidAmounts = ['-1', '-10', '-100.50', '-0.01'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('positive');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle amounts with trailing zeros after decimal', () => {
      const amounts = [
        { input: '10.00', expected: 10.00 },
        { input: '10.10', expected: 10.10 },
        { input: '10.50', expected: 10.50 },
        { input: '10.90', expected: 10.90 },
      ];

      amounts.forEach(({ input, expected }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      });
    });

    it('should handle whitespace around valid amounts', () => {
      const amounts = [
        { input: ' 100 ', expected: 100.00 },
        { input: '\t50.50\t', expected: 50.50 },
        { input: '\n10.99\n', expected: 10.99 },
        { input: '  0.01  ', expected: 0.01 },
      ];

      amounts.forEach(({ input, expected }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      });
    });

    it('should reject null or undefined', () => {
      const result1 = validateAmount(null as any);
      expect(result1.isValid).toBe(false);

      const result2 = validateAmount(undefined as any);
      expect(result2.isValid).toBe(false);
    });

    it('should handle exponential notation correctly', () => {
      const invalidAmounts = ['1e2', '1E2', '10e-1', '1.5e3'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should reject infinity and NaN', () => {
      const invalidAmounts = ['Infinity', '-Infinity', 'NaN'];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('Normalization Consistency', () => {
    it('should normalize single digit decimals to two places', () => {
      const amounts = [
        { input: '10.5', expected: 10.50 },
        { input: '0.1', expected: 0.10 },
        { input: '99.9', expected: 99.90 },
        { input: '1.0', expected: 1.00 },
      ];

      amounts.forEach(({ input, expected }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
        expect(result.formatted).toMatch(/^\d+\.\d{2}$/);
      });
    });

    it('should format amounts for display correctly', () => {
      const amounts = [
        { input: '1234.56', formatted: '1234.56' },
        { input: '10', formatted: '10.00' },
        { input: '0.5', formatted: '0.50' },
        { input: '9999.9', formatted: '9999.90' },
      ];

      amounts.forEach(({ input, formatted }) => {
        const result = validateAmount(input);
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe(formatted);
      });
    });
  });

  describe('Security Tests', () => {
    it('should reject SQL injection attempts', () => {
      const result = validateAmount("100'; DROP TABLE accounts; --");
      expect(result.isValid).toBe(false);
    });

    it('should reject XSS attempts', () => {
      const result = validateAmount('<script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
    });

    it('should reject extremely long inputs', () => {
      const result = validateAmount('1'.repeat(1000));
      expect(result.isValid).toBe(false);
    });

    it('should handle Unicode and special characters', () => {
      const invalidAmounts = [
        '１００', // Full-width digits
        '💰100',
        '₹100',
        '100円',
      ];

      invalidAmounts.forEach(amount => {
        const result = validateAmount(amount);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear error for leading zeros', () => {
      const result = validateAmount('00100');
      expect(result.error).toContain('leading zero');
      expect(result.error).not.toContain('undefined');
    });

    it('should provide clear error for invalid range', () => {
      const result1 = validateAmount('0.00');
      expect(result1.error).toContain('0.01');
      expect(result1.error).toContain('minimum');

      const result2 = validateAmount('10001');
      expect(result2.error).toContain('10,000');
      expect(result2.error).toContain('maximum');
    });

    it('should provide helpful format examples in errors', () => {
      const result = validateAmount('00.50');
      expect(result.error).toContain('0.50');
    });
  });
});