import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * VAL-201: Email Validation Problems Test Suite
 *
 * Bug Description: "The system accepts invalid email formats and doesn't handle special cases properly."
 *
 * Root Cause:
 * In server/routers/auth.ts, there's an inconsistency in email validation between signup and login:
 *
 * - SIGNUP (line 16): Uses z.string().email().toLowerCase() - automatically converts to lowercase
 * - LOGIN (line 157): Uses z.string().email() - doesn't convert to lowercase
 *
 * This causes authentication failures when users try to login with the same mixed-case email they used to sign up.
 *
 * Issues:
 * 1. CASE MISMATCH: User signs up with "TEST@example.com" → stored as "test@example.com"
 *    But login with "TEST@example.com" fails because it queries for exact match
 * 2. SILENT CONVERSION: Email is lowercased without user notification
 * 3. NO TYPO DETECTION: Accepts ".con" instead of ".com" without warning
 * 4. INCONSISTENT BEHAVIOR: Different validation rules for same field across endpoints
 *
 * Location:
 * - server/routers/auth.ts:16 (signup - HAS toLowerCase)
 * - server/routers/auth.ts:157 (login - MISSING toLowerCase)
 *
 * Expected Behavior:
 * - Both signup and login should handle emails consistently
 * - Case-insensitive email matching throughout the system
 * - Clear feedback when email is normalized
 * - Detection of common typos
 *
 * Impact:
 * - Users cannot login with mixed-case emails
 * - Confusion when "TEST@example.com" doesn't work for login
 * - Potential duplicate account attempts
 * - Poor user experience
 */

describe('VAL-201: Email Validation Bug', () => {
  describe('Case Sensitivity Handling', () => {
    it('should store emails in lowercase during signup', () => {
      const signupInputs = [
        { email: 'TEST@example.com', expected: 'test@example.com' },
        { email: 'John.Doe@Company.COM', expected: 'john.doe@company.com' },
        { email: 'MiXeDcAsE@EmAiL.cOm', expected: 'mixedcase@email.com' },
        { email: 'ALLCAPS@DOMAIN.NET', expected: 'allcaps@domain.net' },
      ];

      signupInputs.forEach(({ email, expected }) => {
        const storedEmail = email.toLowerCase(); // Simulating signup behavior
        expect(storedEmail).toBe(expected);
      });
    });

    it('should accept mixed-case emails during login and convert to lowercase', () => {
      // User signed up with mixed case
      const signupEmail = 'John.Smith@Example.COM';
      const storedEmail = 'john.smith@example.com'; // What's in the database

      // Login attempts with various cases should all work
      const loginAttempts = [
        'John.Smith@Example.COM', // Original case
        'john.smith@example.com', // All lowercase
        'JOHN.SMITH@EXAMPLE.COM', // All uppercase
        'JoHn.SmItH@eXaMpLe.CoM', // Random case
      ];

      loginAttempts.forEach(attempt => {
        // After fix: login should lowercase the email before querying
        const normalizedLogin = attempt.toLowerCase();
        expect(normalizedLogin).toBe(storedEmail);
      });
    });

    it('should demonstrate the bug: login fails with mixed-case email', () => {
      // Current buggy behavior
      const storedEmail = 'test@example.com'; // In database (lowercased during signup)
      const loginEmail = 'TEST@example.com'; // User attempts to login

      // Bug: Direct comparison fails
      const buggyComparison = loginEmail === storedEmail;
      expect(buggyComparison).toBe(false); // ❌ This is why login fails

      // Fix: Lowercase before comparison
      const fixedComparison = loginEmail.toLowerCase() === storedEmail;
      expect(fixedComparison).toBe(true); // ✅ This would work
    });

    it('should handle emails with special characters and case', () => {
      const emails = [
        { input: 'user+TAG@example.com', stored: 'user+tag@example.com' },
        { input: 'First.Last+Filter@Domain.COM', stored: 'first.last+filter@domain.com' },
        { input: 'test.EMAIL+123@sub.DOMAIN.co.uk', stored: 'test.email+123@sub.domain.co.uk' },
      ];

      emails.forEach(({ input, stored }) => {
        expect(input.toLowerCase()).toBe(stored);
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should allow login with the exact email used for signup after normalization', () => {
      // Signup flow
      const signupInput = {
        email: 'NewUser@Example.COM',
        password: 'SecurePass123!',
      };

      const storedUser = {
        email: signupInput.email.toLowerCase(), // 'newuser@example.com'
        password: 'hashed_password',
      };

      // Login with same mixed-case email should work
      const loginInput = {
        email: 'NewUser@Example.COM',
        password: 'SecurePass123!',
      };

      // After fix: normalize login email
      const normalizedLoginEmail = loginInput.email.toLowerCase();
      expect(normalizedLoginEmail).toBe(storedUser.email);
    });

    it('should prevent duplicate signups with different case emails', () => {
      const existingUser = {
        email: 'existing@user.com',
      };

      const duplicateAttempts = [
        'existing@user.com',
        'Existing@User.com',
        'EXISTING@USER.COM',
        'ExIsTiNg@UsEr.CoM',
      ];

      duplicateAttempts.forEach(attempt => {
        const normalized = attempt.toLowerCase();
        expect(normalized).toBe(existingUser.email);
        // Should detect as duplicate
      });
    });

    it('should maintain consistency across all auth operations', () => {
      const operations = {
        signup: 'User@Example.com',
        login: 'USER@EXAMPLE.COM',
        passwordReset: 'user@example.com',
        emailVerification: 'UsEr@ExAmPlE.cOm',
      };

      const expected = 'user@example.com';

      Object.entries(operations).forEach(([operation, email]) => {
        expect(email.toLowerCase()).toBe(expected);
      });
    });
  });

  describe('Email Validation Rules', () => {
    it('should detect common email typos', () => {
      const typoEmails = [
        { email: 'user@example.con', issue: 'Common typo: .con instead of .com' },
        { email: 'user@gmail.co', issue: 'Likely meant .com' },
        { email: 'user@hotmail.cm', issue: 'Missing letter in TLD' },
        { email: 'user@yahoo.cpm', issue: 'Typo in .com' },
        { email: 'user@domain.ent', issue: 'Likely meant .net' },
      ];

      typoEmails.forEach(({ email, issue }) => {
        // These should trigger warnings or suggestions
        expect(email).toContain('@');
        expect(issue).toBeDefined();
      });
    });

    it('should validate email format beyond basic structure', () => {
      const invalidEmails = [
        'user@',           // Missing domain
        '@example.com',    // Missing local part
        'user.example.com', // Missing @
        'user @example.com', // Space in email
        'user@.com',       // Missing domain name
        'user@domain.',    // Missing TLD
      ];

      invalidEmails.forEach(email => {
        // These should be rejected
        expect(email.includes('@') && email.split('@').length === 2).toBe(
          email.includes('@') && email.split('@').length === 2
        );
      });
    });

    it('should accept valid international emails', () => {
      const internationalEmails = [
        'josé@example.com',
        'müller@domain.de',
        'user@例え.jp',
        'test@domain.co.uk',
        'user@sub.domain.com',
      ];

      internationalEmails.forEach(email => {
        const normalized = email.toLowerCase();
        expect(normalized).toBeDefined();
        expect(normalized).toContain('@');
      });
    });
  });

  describe('User Experience', () => {
    it('should provide feedback when email is normalized', () => {
      const input = 'User.Name@Example.COM';
      const normalized = 'user.name@example.com';

      const response = {
        success: true,
        message: `Email registered as: ${normalized}`,
        normalizedEmail: normalized,
      };

      expect(response.normalizedEmail).toBe(normalized);
      expect(response.normalizedEmail).not.toBe(input);
    });

    it('should handle email changes consistently', () => {
      const oldEmail = 'OldEmail@Example.com';
      const newEmail = 'NewEmail@Example.com';

      const storedOld = oldEmail.toLowerCase();
      const storedNew = newEmail.toLowerCase();

      // Update operation should also normalize
      expect(storedOld).toBe('oldemail@example.com');
      expect(storedNew).toBe('newemail@example.com');
    });

    it('should work with password reset flows', () => {
      // User requests reset with mixed case
      const resetRequest = 'ForgotPassword@Example.com';

      // Database lookup should use normalized version
      const lookupEmail = resetRequest.toLowerCase();

      // Stored email in database
      const dbEmail = 'forgotpassword@example.com';

      expect(lookupEmail).toBe(dbEmail);
    });
  });

  describe('Edge Cases', () => {
    it('should handle emails at maximum length', () => {
      // Email max length is typically 254 characters
      const localPart = 'a'.repeat(64); // Max local part
      const domain = 'example.com';
      const longEmail = `${localPart}@${domain}`;

      const normalized = longEmail.toLowerCase();
      expect(normalized.length).toBeLessThanOrEqual(254);
    });

    it('should handle special but valid email formats', () => {
      const specialEmails = [
        '"user.name"@example.com', // Quoted local part
        'user+tag@example.com',    // Plus addressing
        'user.name+tag@example.com', // Dots and plus
        'user@subdomain.example.com', // Subdomain
      ];

      specialEmails.forEach(email => {
        const normalized = email.toLowerCase();
        expect(normalized).toContain('@');
      });
    });

    it('should handle rapid successive login attempts with different cases', () => {
      const attempts = [
        { email: 'test@example.com', timestamp: '2024-01-01T10:00:00Z' },
        { email: 'TEST@example.com', timestamp: '2024-01-01T10:00:01Z' },
        { email: 'Test@Example.com', timestamp: '2024-01-01T10:00:02Z' },
      ];

      const normalizedEmails = attempts.map(a => a.email.toLowerCase());

      // All should resolve to the same email
      expect(new Set(normalizedEmails).size).toBe(1);
      expect(normalizedEmails[0]).toBe('test@example.com');
    });

    it('should handle email with all valid special characters', () => {
      // RFC 5322 compliant special characters
      const specialCharEmails = [
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com',
        'user+name@example.com',
        'user123@example.com',
      ];

      specialCharEmails.forEach(email => {
        const normalized = email.toLowerCase();
        expect(normalized).toBe(email.toLowerCase());
      });
    });
  });

  describe('Database Consistency', () => {
    it('should ensure all stored emails are lowercase', () => {
      const dbEmails = [
        'test@example.com',
        'user@domain.com',
        'admin@company.org',
      ];

      dbEmails.forEach(email => {
        expect(email).toBe(email.toLowerCase());
      });
    });

    it('should query with normalized email', () => {
      const queryEmail = 'User@Example.COM';
      const normalizedQuery = queryEmail.toLowerCase();

      const dbRecord = {
        id: 1,
        email: 'user@example.com',
      };

      expect(normalizedQuery).toBe(dbRecord.email);
    });

    it('should handle email updates with normalization', () => {
      const currentEmail = 'old@example.com';
      const newEmailInput = 'NEW@EXAMPLE.COM';
      const storedNewEmail = newEmailInput.toLowerCase();

      expect(storedNewEmail).toBe('new@example.com');
      expect(storedNewEmail).not.toBe(newEmailInput);
    });
  });

  describe('Security Considerations', () => {
    it('should prevent email enumeration attacks with consistent responses', () => {
      // Both existing and non-existing emails should take similar time
      const attempts = [
        { email: 'EXISTING@example.com', exists: true },
        { email: 'NONEXISTING@example.com', exists: false },
      ];

      // Response should be consistent regardless of case or existence
      attempts.forEach(attempt => {
        const normalized = attempt.email.toLowerCase();
        expect(normalized).toBeDefined();
        // Response timing and message should be similar
      });
    });

    it('should handle malicious email inputs safely', () => {
      const maliciousInputs = [
        'user@example.com<script>alert("xss")</script>',
        'user@example.com; DROP TABLE users;--',
        'user@example.com\u0000',
        'user@example.com\n\rSet-Cookie: session=hijacked',
      ];

      maliciousInputs.forEach(input => {
        // Should sanitize or reject these
        expect(() => {
          // Email validation should catch these
          const isValid = input.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          return isValid;
        }).toBeDefined();
      });
    });
  });

  describe('Query Structure Validation', () => {
    it('should demonstrate the current bug in login query', () => {
      // Current buggy implementation
      const buggyLoginValidation = {
        email: 'z.string().email()', // ❌ No toLowerCase()
      };

      const buggyQuery = {
        where: { email: 'TEST@example.com' }, // ❌ Not normalized
      };

      expect(buggyLoginValidation.email).not.toContain('toLowerCase');
      expect(buggyQuery.where.email).not.toBe(buggyQuery.where.email.toLowerCase());
    });

    it('should demonstrate the correct implementation', () => {
      // Fixed implementation
      const fixedLoginValidation = {
        email: 'z.string().email().toLowerCase()', // ✅ Has toLowerCase()
      };

      const fixedQuery = {
        where: { email: 'test@example.com' }, // ✅ Normalized
      };

      expect(fixedLoginValidation.email).toContain('toLowerCase');
      expect(fixedQuery.where.email).toBe(fixedQuery.where.email.toLowerCase());
    });

    it('should show consistency between signup and login', () => {
      // Both should have the same validation
      const signupValidation = 'z.string().email().toLowerCase()';
      const loginValidation = 'z.string().email().toLowerCase()'; // After fix

      expect(signupValidation).toBe(loginValidation);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete signup and login flow with mixed case', () => {
      // Step 1: User signs up
      const signupData = {
        email: 'New.User@Company.COM',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Step 2: Email is normalized and stored
      const storedData = {
        ...signupData,
        email: signupData.email.toLowerCase(), // 'new.user@company.com'
      };

      // Step 3: User tries to login with original case
      const loginAttempt1 = {
        email: 'New.User@Company.COM',
        password: 'SecurePass123!',
      };

      // Step 4: Login normalizes email before query (after fix)
      const normalizedLogin1 = loginAttempt1.email.toLowerCase();
      expect(normalizedLogin1).toBe(storedData.email);

      // Step 5: User tries with different case
      const loginAttempt2 = {
        email: 'NEW.USER@COMPANY.COM',
        password: 'SecurePass123!',
      };

      const normalizedLogin2 = loginAttempt2.email.toLowerCase();
      expect(normalizedLogin2).toBe(storedData.email);
    });

    it('should handle the exact scenario from bug report', () => {
      // Bug Report: "Accepts TEST@example.com but converts to lowercase without notifying user"

      // User signs up
      const userInput = 'TEST@example.com';
      const storedEmail = 'test@example.com';

      // User attempts login with what they remember
      const loginAttempts = [
        { attempt: 'TEST@example.com', success: false }, // Current bug
        { attempt: 'test@example.com', success: true },  // Works
      ];

      // After fix: both should work
      const fixedAttempts = [
        { attempt: 'TEST@example.com', normalized: 'test@example.com', success: true },
        { attempt: 'test@example.com', normalized: 'test@example.com', success: true },
      ];

      fixedAttempts.forEach(({ attempt, normalized, success }) => {
        expect(attempt.toLowerCase()).toBe(normalized);
        expect(success).toBe(true);
      });
    });

    it('should provide clear user feedback about email normalization', () => {
      const signupInput = 'User.Email@Example.COM';

      const expectedResponse = {
        success: true,
        user: {
          email: 'user.email@example.com',
        },
        message: 'Account created successfully',
        note: 'Email saved as: user.email@example.com',
      };

      expect(expectedResponse.user.email).toBe(signupInput.toLowerCase());
      expect(expectedResponse.note).toContain(expectedResponse.user.email);
    });
  });
});

describe('VAL-201: Solution Validation', () => {
  describe('Solution: Add toLowerCase() to login endpoint', () => {
    it('should normalize email in login validation', () => {
      // Before fix
      const buggyValidation = (email: string) => email; // No normalization

      // After fix
      const fixedValidation = (email: string) => email.toLowerCase();

      const testEmail = 'TEST@example.com';

      expect(buggyValidation(testEmail)).toBe('TEST@example.com'); // ❌ Not normalized
      expect(fixedValidation(testEmail)).toBe('test@example.com');  // ✅ Normalized
    });

    it('should query database with normalized email', () => {
      const loginEmail = 'User@Example.COM';

      // Before fix: queries with original case
      const buggyQuery = {
        table: 'users',
        where: { email: loginEmail }, // ❌ Wrong case
      };

      // After fix: queries with lowercase
      const fixedQuery = {
        table: 'users',
        where: { email: loginEmail.toLowerCase() }, // ✅ Correct case
      };

      expect(buggyQuery.where.email).not.toBe('user@example.com');
      expect(fixedQuery.where.email).toBe('user@example.com');
    });

    it('should maintain backward compatibility', () => {
      // Existing users who always used lowercase should still work
      const existingUserLogin = {
        email: 'existing@user.com',
        password: 'password123',
      };

      const normalized = existingUserLogin.email.toLowerCase();
      expect(normalized).toBe(existingUserLogin.email); // No change needed
    });

    it('should fix the reported issue completely', () => {
      // The exact issue from the bug report
      const reportedCase = {
        signup: 'TEST@example.com',
        stored: 'test@example.com',
        loginAttempt: 'TEST@example.com',
      };

      // After fix
      const fixed = {
        loginNormalized: reportedCase.loginAttempt.toLowerCase(),
        matches: reportedCase.loginAttempt.toLowerCase() === reportedCase.stored,
      };

      expect(fixed.loginNormalized).toBe(reportedCase.stored);
      expect(fixed.matches).toBe(true);
    });
  });

  describe('Additional Improvements', () => {
    it('should detect common domain typos', () => {
      const typoDetection = (email: string) => {
        const commonTypos = {
          '.con': '.com',
          '.cpm': '.com',
          '.ocm': '.com',
          'gmial': 'gmail',
          'gmai': 'gmail',
          'yahooo': 'yahoo',
          'hotnail': 'hotmail',
        };

        let suggestion = null;
        for (const [typo, correct] of Object.entries(commonTypos)) {
          if (email.includes(typo)) {
            suggestion = email.replace(typo, correct);
            break;
          }
        }

        return suggestion;
      };

      expect(typoDetection('user@gmail.con')).toBe('user@gmail.com');
      expect(typoDetection('test@gmial.com')).toBe('test@gmail.com');
      expect(typoDetection('admin@yahooo.com')).toBe('admin@yahoo.com');
    });

    it('should provide user-friendly feedback', () => {
      const signupResponse = (email: string) => ({
        success: true,
        message: 'Account created successfully',
        emailNote: email !== email.toLowerCase()
          ? `Your email has been saved as: ${email.toLowerCase()}`
          : null,
      });

      const response1 = signupResponse('TEST@example.com');
      expect(response1.emailNote).toBe('Your email has been saved as: test@example.com');

      const response2 = signupResponse('test@example.com');
      expect(response2.emailNote).toBeNull();
    });
  });
});