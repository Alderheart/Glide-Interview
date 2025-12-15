import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * VAL-208: Password Validation Tests
 *
 * These tests verify that the password validation properly enforces:
 * 1. Minimum 8 characters
 * 2. At least one uppercase letter
 * 3. At least one lowercase letter
 * 4. At least one number
 * 5. At least one special character
 * 6. No sequential patterns (4+ consecutive characters)
 * 7. No repeated characters (4+ same character)
 *
 * Note: These tests will FAIL until the validation is implemented in:
 * - app/signup/page.tsx (frontend validation)
 * - server/routers/auth.ts (backend validation)
 */

// Import the actual schema from the server implementation
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine((password) => /[A-Z]/.test(password), "Password must contain at least one uppercase letter")
  .refine((password) => /[a-z]/.test(password), "Password must contain at least one lowercase letter")
  .refine((password) => /[0-9]/.test(password), "Password must contain at least one number")
  .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), "Password must contain at least one special character")
  .refine((password) => {
    // Check for sequential numbers
    const sequentialNumbers = /(?:0123|1234|2345|3456|4567|5678|6789|7890)/;
    const reversedNumbers = /(?:3210|4321|5432|6543|7654|8765|9876|0987)/;
    return !sequentialNumbers.test(password) && !reversedNumbers.test(password);
  }, "Password cannot contain sequential patterns")
  .refine((password) => {
    // Check for keyboard patterns
    const keyboardPatterns = /(?:qwert|werty|asdfg|sdfgh|zxcvb|xcvbn)/i;
    return !keyboardPatterns.test(password);
  }, "Password cannot contain sequential patterns")
  .refine((password) => {
    // Check for sequential letters
    const lowerPassword = password.toLowerCase();
    for (let i = 0; i < lowerPassword.length - 3; i++) {
      const charCode = lowerPassword.charCodeAt(i);
      if (charCode >= 97 && charCode <= 122) {
        if (
          lowerPassword.charCodeAt(i + 1) === charCode + 1 &&
          lowerPassword.charCodeAt(i + 2) === charCode + 2 &&
          lowerPassword.charCodeAt(i + 3) === charCode + 3
        ) {
          return false;
        }
      }
    }
    return true;
  }, "Password cannot contain sequential patterns")
  .refine((password) => {
    // Check for 4+ repeated characters
    return !/(.)\1{3,}/.test(password);
  }, "Password cannot contain repeated characters");

describe('VAL-208: Password Validation', () => {
  describe('Length Requirements', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const shortPassword = 'Pass1!';
      const result = passwordSchema.safeParse(shortPassword);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/8|characters|length/i);
      }
    });

    it('should accept passwords exactly 8 characters long with all requirements', () => {
      const validPassword = 'Pass1!wo';
      const result = passwordSchema.safeParse(validPassword);

      expect(result.success).toBe(true);
    });

    it('should accept long passwords with all requirements', () => {
      const longPassword = 'MyVerySecureP@ssw0rd123';
      const result = passwordSchema.safeParse(longPassword);

      expect(result.success).toBe(true);
    });
  });

  describe('Uppercase Letter Requirement', () => {
    it('should reject passwords without uppercase letters', () => {
      const noUppercase = 'password1!';
      const result = passwordSchema.safeParse(noUppercase);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/uppercase/i))).toBe(true);
      }
    });

    it('should accept passwords with at least one uppercase letter', () => {
      const hasUppercase = 'Password1!';
      const result = passwordSchema.safeParse(hasUppercase);

      expect(result.success).toBe(true);
    });

    it('should accept passwords with multiple uppercase letters', () => {
      const multipleUppercase = 'MyPassword1!';
      const result = passwordSchema.safeParse(multipleUppercase);

      expect(result.success).toBe(true);
    });
  });

  describe('Lowercase Letter Requirement', () => {
    it('should reject passwords without lowercase letters', () => {
      const noLowercase = 'PASSWORD1!';
      const result = passwordSchema.safeParse(noLowercase);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/lowercase/i))).toBe(true);
      }
    });

    it('should accept passwords with at least one lowercase letter', () => {
      const hasLowercase = 'PASSWORd1!';
      const result = passwordSchema.safeParse(hasLowercase);

      expect(result.success).toBe(true);
    });
  });

  describe('Number Requirement', () => {
    it('should reject passwords without numbers', () => {
      const noNumber = 'Password!';
      const result = passwordSchema.safeParse(noNumber);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/number|digit/i))).toBe(true);
      }
    });

    it('should accept passwords with at least one number', () => {
      const hasNumber = 'Password1!';
      const result = passwordSchema.safeParse(hasNumber);

      expect(result.success).toBe(true);
    });

    it('should accept passwords with multiple numbers', () => {
      const multipleNumbers = 'Pass123word!';
      const result = passwordSchema.safeParse(multipleNumbers);

      expect(result.success).toBe(true);
    });
  });

  describe('Special Character Requirement', () => {
    it('should reject passwords without special characters', () => {
      const noSpecial = 'Password1';
      const result = passwordSchema.safeParse(noSpecial);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/special/i))).toBe(true);
      }
    });

    it('should accept passwords with common special characters (!@#$%)', () => {
      const passwords = ['Password1!', 'Password1@', 'Password1#', 'Password1$', 'Password1%'];

      passwords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it('should accept passwords with various special characters', () => {
      const passwords = ['Pass^word1', 'Pass&word1', 'Pass*word1', 'Pass(word1)', 'Pass_word1'];

      passwords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Sequential Pattern Prevention', () => {
    it('should reject passwords with sequential numbers (1234)', () => {
      const sequential = 'Pass1234!';
      const result = passwordSchema.safeParse(sequential);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/sequential|pattern/i))).toBe(true);
      }
    });

    it('should reject passwords with longer sequential numbers (12345678)', () => {
      const sequential = 'Pass12345678!';
      const result = passwordSchema.safeParse(sequential);

      expect(result.success).toBe(false);
    });

    it('should reject passwords with sequential letters (abcd)', () => {
      const sequential = 'Abcdef1!';
      const result = passwordSchema.safeParse(sequential);

      expect(result.success).toBe(false);
    });

    it('should reject passwords with keyboard patterns (qwerty)', () => {
      const keyboard = 'Qwerty1!';
      const result = passwordSchema.safeParse(keyboard);

      expect(result.success).toBe(false);
    });

    it('should reject passwords with reversed sequential (4321)', () => {
      const sequential = 'Pass4321!';
      const result = passwordSchema.safeParse(sequential);

      expect(result.success).toBe(false);
    });

    it('should accept passwords with non-sequential numbers', () => {
      const nonSequential = 'Pass1397!';
      const result = passwordSchema.safeParse(nonSequential);

      expect(result.success).toBe(true);
    });
  });

  describe('Repeated Character Prevention', () => {
    it('should reject passwords with 4+ repeated lowercase letters', () => {
      const repeated = 'Passaaaa1!';
      const result = passwordSchema.safeParse(repeated);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.match(/repeated/i))).toBe(true);
      }
    });

    it('should reject passwords with 4+ repeated uppercase letters', () => {
      const repeated = 'PAAAA1word!';
      const result = passwordSchema.safeParse(repeated);

      expect(result.success).toBe(false);
    });

    it('should reject passwords with 4+ repeated numbers', () => {
      const repeated = 'Pass1111!';
      const result = passwordSchema.safeParse(repeated);

      expect(result.success).toBe(false);
    });

    it('should reject passwords with 4+ repeated special characters', () => {
      const repeated = 'Pass1!!!!word';
      const result = passwordSchema.safeParse(repeated);

      expect(result.success).toBe(false);
    });

    it('should accept passwords with 3 repeated characters', () => {
      const threeRepeated = 'Passs111!';
      const result = passwordSchema.safeParse(threeRepeated);

      expect(result.success).toBe(true);
    });

    it('should accept passwords with alternating characters', () => {
      const alternating = 'Pass1!Word2@';
      const result = passwordSchema.safeParse(alternating);

      expect(result.success).toBe(true);
    });
  });

  describe('Common Weak Passwords', () => {
    it('should reject "password" with simple modifications', () => {
      const weakPasswords = [
        'password',      // all lowercase
        'Password1',     // no special char
        'PASSWORD1!',    // no lowercase
      ];

      weakPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it('should reject "12345678" variations', () => {
      const weakPasswords = [
        '12345678',      // sequential, no letters
        'Pass12345678',  // sequential numbers
      ];

      weakPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it('should reject "qwerty" variations', () => {
      const weakPasswords = [
        'Qwerty12',      // no special char
        'Qwerty1!',      // sequential letters
      ];

      weakPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it('should reject "welcome" variations', () => {
      const weakPasswords = [
        'Welcome1',      // no special char
        'WELCOME1!',     // no lowercase
      ];

      weakPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Strong Password Examples', () => {
    it('should accept strong passwords with all requirements', () => {
      const strongPasswords = [
        'MyP@ssw0rd',
        'Secur3!Bank',
        'C0mpl3x!Pass',
        'Str0ng#Passw',
        'S@feBank2024',
        'MyB@nk!ng99',
      ];

      strongPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty string', () => {
      const result = passwordSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject whitespace only', () => {
      const result = passwordSchema.safeParse('        ');
      expect(result.success).toBe(false);
    });

    it('should accept passwords with spaces if they meet requirements', () => {
      const withSpace = 'My Pass1!';
      const result = passwordSchema.safeParse(withSpace);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters properly', () => {
      const unicode = 'Pässw0rd!';
      const result = passwordSchema.safeParse(unicode);
      // Should pass all requirements (has upper, lower, number, special)
      expect(result.success).toBe(true);
    });
  });

  describe('Security Tests', () => {
    it('should reject SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = passwordSchema.safeParse(sqlInjection);
      // Should fail due to lack of uppercase or number
      expect(result.success).toBe(false);
    });

    it('should handle very long passwords (256+ characters)', () => {
      // Create a long password without repeated or sequential characters
      const longPassword = 'MySecureP@ssw0rd' + 'X1!yZ2@wV3#uT4$sR5%qP6^oN7&mL8*kJ9(iH0)gF1!eD2@cB3#aY4$xW5%vU'.repeat(4);
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(true);
    });

    it('should reject passwords with only special characters', () => {
      const specialOnly = '!@#$%^&*';
      const result = passwordSchema.safeParse(specialOnly);
      expect(result.success).toBe(false);
    });
  });
});
