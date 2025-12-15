import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptSSN, decryptSSN, maskSSN, isEncryptedSSN } from '@/lib/encryption/ssn';

describe('SSN Encryption', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encryptSSN', () => {
    it('should encrypt a valid SSN', () => {
      const ssn = '123456789';
      const encrypted = encryptSSN(ssn);

      expect(encrypted).toBeTruthy();
      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(3);
      expect(encrypted).not.toContain(ssn);
    });

    it('should generate different encrypted values for the same SSN', () => {
      const ssn = '123456789';
      const encrypted1 = encryptSSN(ssn);
      const encrypted2 = encryptSSN(ssn);

      // Different IVs should make them different
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should reject invalid SSN formats', () => {
      expect(() => encryptSSN('12345678')).toThrow('Invalid SSN format');
      expect(() => encryptSSN('1234567890')).toThrow('Invalid SSN format');
      expect(() => encryptSSN('12345678a')).toThrow('Invalid SSN format');
      expect(() => encryptSSN('123-45-6789')).toThrow('Invalid SSN format');
      expect(() => encryptSSN('')).toThrow('Invalid SSN format');
    });
  });

  describe('decryptSSN', () => {
    it('should decrypt an encrypted SSN correctly', () => {
      const originalSSN = '123456789';
      const encrypted = encryptSSN(originalSSN);
      const decrypted = decryptSSN(encrypted);

      expect(decrypted).toBe(originalSSN);
    });

    it('should handle multiple SSNs correctly', () => {
      const ssns = ['111223333', '444556666', '777889999', '000111222'];

      ssns.forEach(ssn => {
        const encrypted = encryptSSN(ssn);
        const decrypted = decryptSSN(encrypted);
        expect(decrypted).toBe(ssn);
      });
    });

    it('should reject invalid encrypted formats', () => {
      expect(() => decryptSSN('invalid')).toThrow('Invalid encrypted SSN format');
      expect(() => decryptSSN('part1:part2')).toThrow('Invalid encrypted SSN format');
      expect(() => decryptSSN('')).toThrow('Invalid encrypted SSN format');
    });

    it('should fail with tampered data', () => {
      const encrypted = encryptSSN('123456789');
      const parts = encrypted.split(':');

      // Tamper with the encrypted data
      parts[1] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');

      expect(() => decryptSSN(tampered)).toThrow('Failed to decrypt SSN');
    });
  });

  describe('maskSSN', () => {
    it('should mask a plain SSN', () => {
      const ssn = '123456789';
      const masked = maskSSN(ssn);

      expect(masked).toBe('XXX-XX-6789');
    });

    it('should mask an encrypted SSN', () => {
      const ssn = '987654321';
      const encrypted = encryptSSN(ssn);
      const masked = maskSSN(encrypted);

      expect(masked).toBe('XXX-XX-4321');
    });

    it('should handle different SSN endings', () => {
      expect(maskSSN('111111111')).toBe('XXX-XX-1111');
      expect(maskSSN('222220000')).toBe('XXX-XX-0000');
      expect(maskSSN('333339999')).toBe('XXX-XX-9999');
    });

    it('should return default mask for invalid SSNs', () => {
      expect(maskSSN('')).toBe('XXX-XX-XXXX');
      expect(maskSSN('invalid')).toBe('XXX-XX-XXXX');
      expect(maskSSN('12345678')).toBe('XXX-XX-XXXX');
      expect(maskSSN('12345678a')).toBe('XXX-XX-XXXX');
    });

    it('should return default mask for corrupted encrypted SSNs', () => {
      const corrupted = 'abc:def:ghi';
      expect(maskSSN(corrupted)).toBe('XXX-XX-XXXX');
    });
  });

  describe('isEncryptedSSN', () => {
    it('should identify encrypted SSNs', () => {
      const encrypted = encryptSSN('123456789');
      expect(isEncryptedSSN(encrypted)).toBe(true);
    });

    it('should reject plain SSNs', () => {
      expect(isEncryptedSSN('123456789')).toBe(false);
      expect(isEncryptedSSN('123-45-6789')).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(isEncryptedSSN('')).toBe(false);
      expect(isEncryptedSSN('part1:part2')).toBe(false);
      expect(isEncryptedSSN('part1:part2:part3:part4')).toBe(false);
      expect(isEncryptedSSN('not:base64:values!')).toBe(false);
    });

    it('should validate base64 format', () => {
      // Valid base64 format but not from our encryption
      expect(isEncryptedSSN('YWJj:ZGVm:Z2hp')).toBe(true);

      // Invalid base64 characters
      expect(isEncryptedSSN('abc!:def@:ghi#')).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should not expose SSN in error messages', () => {
      const ssn = '123456789';

      try {
        // Force an error by unsetting the key
        const tempKey = process.env.ENCRYPTION_KEY;
        delete process.env.ENCRYPTION_KEY;
        encryptSSN(ssn);
        process.env.ENCRYPTION_KEY = tempKey;
      } catch (error: any) {
        expect(error.message).not.toContain(ssn);
      }
    });

    it('should handle edge case SSNs', () => {
      // Make sure we have a valid key
      const tempKey = process.env.ENCRYPTION_KEY;
      if (!tempKey) {
        process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      }

      const edgeCases = ['000000000', '999999999', '000000001', '100000000'];

      edgeCases.forEach(ssn => {
        const encrypted = encryptSSN(ssn);
        const decrypted = decryptSSN(encrypted);
        expect(decrypted).toBe(ssn);
      });

      // Restore original key if we changed it
      if (!tempKey) {
        process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      }
    });

    it('should require exact key for decryption', () => {
      // Ensure we have a valid initial key
      const originalKey = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);

      const ssn = '123456789';
      const encrypted = encryptSSN(ssn);

      // Change the key
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);

      expect(() => decryptSSN(encrypted)).toThrow('Failed to decrypt SSN');

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Environment Key Validation', () => {
    it('should throw error when key is missing', () => {
      const tempKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encryptSSN('123456789')).toThrow('ENCRYPTION_KEY environment variable is not set');

      process.env.ENCRYPTION_KEY = tempKey;
    });

    it('should throw error when key is wrong length', () => {
      const tempKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'shortkey';

      expect(() => encryptSSN('123456789')).toThrow('ENCRYPTION_KEY must be exactly 32 bytes');

      process.env.ENCRYPTION_KEY = tempKey;
    });
  });
});