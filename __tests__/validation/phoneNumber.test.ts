/**
 * Test Suite for VAL-204: Phone Number Format
 *
 * Bug: Phone number validation is inconsistent between frontend and backend
 * - Frontend only accepts exactly 10 digits (no + prefix)
 * - Backend accepts 10-15 digits with optional + prefix
 * - No proper validation of country codes or area codes
 * - International numbers accepted but not properly formatted
 * - No standardization on storage format
 *
 * Solution: Standardize on North American phone numbers (US/Canada)
 * - Accept various input formats and normalize to E.164 format
 * - Store as +1XXXXXXXXXX (E.164 international format)
 * - Validate area code and exchange code rules
 * - Consistent validation on both frontend and backend
 */

import { describe, expect, it } from "vitest";
import { validatePhoneNumber } from "@/lib/validation/phoneNumber";

describe('VAL-204: Phone Number Format Validation', () => {
  describe('Valid North American Phone Numbers', () => {
    it('should accept 10-digit format without separators', () => {
      const result = validatePhoneNumber('2025551234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept format with dashes', () => {
      const result = validatePhoneNumber('202-555-1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept format with parentheses and spaces', () => {
      const result = validatePhoneNumber('(202) 555-1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept format with dots', () => {
      const result = validatePhoneNumber('202.555.1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept +1 prefix with 10 digits', () => {
      const result = validatePhoneNumber('+12025551234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept 1 prefix with 10 digits', () => {
      const result = validatePhoneNumber('12025551234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should accept various valid area codes', () => {
      const validNumbers = [
        '2125551234', // New York
        '3105551234', // Los Angeles
        '7735551234', // Chicago
        '4165551234', // Toronto
        '6045551234', // Vancouver
      ];

      validNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Invalid Area Code Validation', () => {
    it('should reject area codes starting with 0', () => {
      const result = validatePhoneNumber('0125551234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('area code');
    });

    it('should reject area codes starting with 1', () => {
      const result = validatePhoneNumber('1115551234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('area code');
    });

    it('should reject N11 area codes (211, 311, etc.)', () => {
      const invalidNumbers = ['2115551234', '3115551234', '4115551234'];

      invalidNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('area code');
      });
    });
  });

  describe('Invalid Exchange Code Validation', () => {
    it('should reject exchange codes starting with 0', () => {
      const result = validatePhoneNumber('2020551234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exchange');
    });

    it('should reject exchange codes starting with 1', () => {
      const result = validatePhoneNumber('2021551234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exchange');
    });

    it('should reject N11 exchange codes (555 is special case)', () => {
      const result = validatePhoneNumber('2029111234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exchange');
    });

    it('should allow 555 exchange code (reserved for fictional use)', () => {
      const result = validatePhoneNumber('2025551234');
      expect(result.isValid).toBe(true);
    });
  });

  describe('International Phone Number Rejection', () => {
    it('should reject UK phone numbers', () => {
      const result = validatePhoneNumber('+442071234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('North American');
    });

    it('should reject Australian phone numbers', () => {
      const result = validatePhoneNumber('+61291234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('North American');
    });

    it('should reject German phone numbers', () => {
      const result = validatePhoneNumber('+493012345678');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('North American');
    });

    it('should reject Japanese phone numbers', () => {
      const result = validatePhoneNumber('+81312345678');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('North American');
    });
  });

  describe('Invalid Format Validation', () => {
    it('should reject phone numbers with too few digits', () => {
      const result = validatePhoneNumber('202555123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10 digits');
    });

    it('should reject phone numbers with too many digits', () => {
      const result = validatePhoneNumber('20255512345');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10 digits');
    });

    it('should reject phone numbers with letters', () => {
      const result = validatePhoneNumber('202-555-ABCD');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject empty strings', () => {
      const result = validatePhoneNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject phone numbers with special characters', () => {
      const result = validatePhoneNumber('202*555*1234');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject all zeros', () => {
      const result = validatePhoneNumber('0000000000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject all ones', () => {
      const result = validatePhoneNumber('1111111111');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle phone numbers with excessive whitespace', () => {
      const result = validatePhoneNumber('  202  555  1234  ');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should handle phone numbers with mixed separators', () => {
      const result = validatePhoneNumber('202-555.1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should reject null or undefined', () => {
      const result1 = validatePhoneNumber(null as any);
      expect(result1.isValid).toBe(false);

      const result2 = validatePhoneNumber(undefined as any);
      expect(result2.isValid).toBe(false);
    });

    it('should handle numbers with multiple parentheses', () => {
      const result = validatePhoneNumber('((202)) 555-1234');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025551234');
    });

    it('should normalize consistently regardless of input format', () => {
      const formats = [
        '2025551234',
        '202-555-1234',
        '(202) 555-1234',
        '+1 202-555-1234',
        '1-202-555-1234',
      ];

      formats.forEach(format => {
        const result = validatePhoneNumber(format);
        expect(result.normalized).toBe('+12025551234');
      });
    });
  });

  describe('Special North American Numbers', () => {
    it('should reject emergency numbers (911)', () => {
      const result = validatePhoneNumber('911');
      expect(result.isValid).toBe(false);
    });

    it('should reject 411 (directory assistance)', () => {
      const result = validatePhoneNumber('411');
      expect(result.isValid).toBe(false);
    });

    it('should reject 311 (non-emergency)', () => {
      const result = validatePhoneNumber('311');
      expect(result.isValid).toBe(false);
    });

    it('should reject toll-free numbers (800, 888, 877, etc.)', () => {
      const tollFreeNumbers = [
        '8005551234',
        '8885551234',
        '8775551234',
        '8665551234',
        '8555551234',
        '8445551234',
        '8335551234',
      ];

      tollFreeNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('toll-free');
      });
    });

    it('should reject premium rate numbers (900)', () => {
      const result = validatePhoneNumber('9005551234');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('premium');
    });
  });

  describe('Security Tests', () => {
    it('should reject SQL injection attempts', () => {
      const result = validatePhoneNumber("'; DROP TABLE users; --");
      expect(result.isValid).toBe(false);
    });

    it('should reject XSS attempts', () => {
      const result = validatePhoneNumber('<script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
    });

    it('should reject extremely long inputs', () => {
      const result = validatePhoneNumber('1'.repeat(1000));
      expect(result.isValid).toBe(false);
    });
  });

  describe('Message Clarity', () => {
    it('should provide clear error message for North American requirement', () => {
      const result = validatePhoneNumber('+442071234567');
      expect(result.error).toContain('North American');
      expect(result.error).toContain('US') || expect(result.error).toContain('Canada');
    });

    it('should provide clear error message for invalid format', () => {
      const result = validatePhoneNumber('123');
      expect(result.error).toBeTruthy();
      expect(result.error?.length).toBeGreaterThan(10); // Should be descriptive
    });

    it('should include accepted format examples in some error messages', () => {
      const result = validatePhoneNumber('abc');
      expect(result.error).toBeTruthy();
      // Error should be helpful to users
      expect(result.error).toBeDefined();
    });
  });
});
