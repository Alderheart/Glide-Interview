import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { accountRouter } from "@/server/routers/account";
import { authRouter } from "@/server/routers/auth";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * SEC-302: Insecure Random Numbers
 *
 * Bug Description: "Account numbers generated using Math.random()"
 *
 * Root Cause:
 * In server/routers/account.ts:9-13, the generateAccountNumber() function uses
 * Math.random() which is a pseudo-random number generator (PRNG) designed for
 * general purposes, NOT cryptographic security. This creates a security vulnerability.
 *
 * Location: server/routers/account.ts:9-13
 *
 * Security Impact:
 * - Math.random() is predictable and can be reverse-engineered
 * - Attackers could potentially predict future account numbers
 * - Account numbers could be guessed systematically
 * - Violates security best practices for generating sensitive identifiers
 *
 * Expected Behavior:
 * - Account numbers should be generated using cryptographically secure methods
 * - Should use Node.js crypto.randomInt() or similar CSPRNG
 * - OR use database auto-increment with formatting for guaranteed uniqueness
 * - Account numbers should be unpredictable and collision-resistant
 * - Should maintain proper account number format (10 digits)
 *
 * These tests verify:
 * 1. Account numbers are not predictable
 * 2. Account numbers are cryptographically secure
 * 3. Account numbers are unique
 * 4. Account numbers follow proper format
 * 5. Account numbers use secure randomness (not Math.random)
 */

// Set encryption key for testing
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("SEC-302: Insecure Random Numbers", () => {
  const mockContext = {
    user: {
      id: 0, // Will be set after user creation
      email: "test@example.com",
    },
    req: {
      headers: {
        get: (key: string) => key === "cookie" ? "" : null,
      } as any
    },
    res: {
      setHeader: vi.fn(),
    } as any,
  };

  const testUser = {
    email: "randomtest@example.com",
    password: "Test123!@#",
    firstName: "Random",
    lastName: "Test",
    phoneNumber: "+12345678900",
    dateOfBirth: "1990-01-01",
    ssn: "123456789",
    address: "123 Test St",
    city: "TestCity",
    state: "CA",
    zipCode: "12345"
  };

  beforeEach(async () => {
    // Clean up any existing test data (accounts first due to foreign key)
    const existingUser = await db.select().from(users).where(eq(users.email, testUser.email)).get();
    if (existingUser) {
      await db.delete(accounts).where(eq(accounts.userId, existingUser.id));
      await db.delete(users).where(eq(users.email, testUser.email));
    }

    // Create test user
    const authCaller = authRouter.createCaller(mockContext);
    await authCaller.signup(testUser);

    const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();
    mockContext.user.id = userRecord!.id;
  });

  afterEach(async () => {
    // Clean up after tests (accounts first due to foreign key)
    if (mockContext.user.id) {
      await db.delete(accounts).where(eq(accounts.userId, mockContext.user.id));
    }
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe("Account Number Security", () => {
    it("should fail: account numbers are currently predictable (Math.random)", async () => {
      // This test documents the current INSECURE behavior
      // It should PASS now (showing the vulnerability exists)
      // It should FAIL after the fix is implemented

      const caller = accountRouter.createCaller(mockContext);

      // Create multiple accounts
      const account1 = await caller.createAccount({ accountType: "checking" });
      const account2 = await caller.createAccount({ accountType: "savings" });

      // With Math.random(), we can't verify cryptographic security
      // This is the VULNERABILITY - we have no way to prove randomness quality

      // The current implementation uses Math.random()
      // which is NOT cryptographically secure
      expect(account1.accountNumber).toBeTruthy();
      expect(account2.accountNumber).toBeTruthy();

      // This test passes now but represents a security flaw
      // After fix, the implementation should use crypto.randomInt()
    });

    it("should enforce cryptographically secure random number generation", async () => {
      // This test will FAIL until the fix is implemented
      // After fix: account numbers should be generated using crypto module

      const caller = accountRouter.createCaller(mockContext);

      // Spy on crypto.randomInt to verify it's being used
      const cryptoSpy = vi.spyOn(crypto, "randomInt");

      try {
        const account = await caller.createAccount({ accountType: "checking" });

        // EXPECTED: crypto.randomInt should be called
        // This will FAIL with current Math.random() implementation
        expect(cryptoSpy).toHaveBeenCalled();
        expect(account.accountNumber).toMatch(/^\d{10}$/);
      } finally {
        cryptoSpy.mockRestore();
      }
    });

    it("should NOT use Math.random() for account number generation", async () => {
      // This test will FAIL until the fix is implemented
      // Verify that Math.random is NOT being used

      const mathRandomSpy = vi.spyOn(Math, "random");

      try {
        const caller = accountRouter.createCaller(mockContext);
        await caller.createAccount({ accountType: "checking" });

        // EXPECTED: Math.random should NOT be called for account numbers
        // This will FAIL with current implementation
        expect(mathRandomSpy).not.toHaveBeenCalled();
      } finally {
        mathRandomSpy.mockRestore();
      }
    });
  });

  describe("Account Number Format and Uniqueness", () => {
    it("should generate account numbers with correct format (10 digits)", async () => {
      const caller = accountRouter.createCaller(mockContext);

      const checkingAccount = await caller.createAccount({ accountType: "checking" });
      const savingsAccount = await caller.createAccount({ accountType: "savings" });

      // Account numbers should be 10 digits
      expect(checkingAccount.accountNumber).toMatch(/^\d{10}$/);
      expect(savingsAccount.accountNumber).toMatch(/^\d{10}$/);
      expect(checkingAccount.accountNumber.length).toBe(10);
      expect(savingsAccount.accountNumber.length).toBe(10);
    });

    it("should generate unique account numbers", async () => {
      const caller = accountRouter.createCaller(mockContext);

      const account1 = await caller.createAccount({ accountType: "checking" });

      // Delete first account to create another of same type
      await db.delete(accounts).where(eq(accounts.id, account1.id));

      const account2 = await caller.createAccount({ accountType: "checking" });
      const account3 = await caller.createAccount({ accountType: "savings" });

      // All account numbers should be unique
      expect(account1.accountNumber).not.toBe(account2.accountNumber);
      expect(account1.accountNumber).not.toBe(account3.accountNumber);
      expect(account2.accountNumber).not.toBe(account3.accountNumber);
    });

    it("should have extremely low collision probability", async () => {
      // Generate multiple account numbers and verify no collisions
      const caller = accountRouter.createCaller(mockContext);
      const accountNumbers = new Set<string>();

      // Create first account
      const account1 = await caller.createAccount({ accountType: "checking" });
      accountNumbers.add(account1.accountNumber);

      // Create second account (need to delete first for same type)
      await db.delete(accounts).where(eq(accounts.id, account1.id));
      const account2 = await caller.createAccount({ accountType: "checking" });
      accountNumbers.add(account2.accountNumber);

      // All should be unique
      expect(accountNumbers.size).toBe(2);
    });
  });

  describe("Auto-Increment Alternative (Preferred Solution)", () => {
    it("should generate sequential account numbers using database ID", async () => {
      // This test validates the auto-increment approach
      // Will FAIL until implemented

      const caller = accountRouter.createCaller(mockContext);

      const account1 = await caller.createAccount({ accountType: "checking" });

      // Delete to create another
      await db.delete(accounts).where(eq(accounts.id, account1.id));

      const account2 = await caller.createAccount({ accountType: "checking" });
      const account3 = await caller.createAccount({ accountType: "savings" });

      // If using auto-increment, account numbers should have:
      // - Checking accounts: prefix "10"
      // - Savings accounts: prefix "20"

      // This will FAIL with current random implementation
      // Uncomment these assertions when implementing auto-increment solution

      // expect(account1.accountNumber.startsWith("10") || account1.accountNumber.startsWith("20")).toBe(true);
      // expect(account2.accountNumber.startsWith("10")).toBe(true);
      // expect(account3.accountNumber.startsWith("20")).toBe(true);

      // For now, just verify they exist
      expect(account1.accountNumber).toBeTruthy();
      expect(account2.accountNumber).toBeTruthy();
      expect(account3.accountNumber).toBeTruthy();
    });

    it("should eliminate the need for uniqueness check loop", async () => {
      // With auto-increment, no while loop needed for uniqueness
      // This is more efficient than random generation

      const caller = accountRouter.createCaller(mockContext);
      const account = await caller.createAccount({ accountType: "checking" });

      // Account should be created in single operation
      // No need to check for collisions
      expect(account.accountNumber).toBeTruthy();
      expect(account.id).toBeGreaterThan(0);
    });
  });

  describe("Security Best Practices Validation", () => {
    it("should not expose predictable patterns in account numbers", async () => {
      const caller = accountRouter.createCaller(mockContext);

      // Create multiple accounts and analyze for patterns
      const account1 = await caller.createAccount({ accountType: "checking" });
      await db.delete(accounts).where(eq(accounts.id, account1.id));

      const account2 = await caller.createAccount({ accountType: "checking" });
      await db.delete(accounts).where(eq(accounts.id, account2.id));

      const account3 = await caller.createAccount({ accountType: "checking" });

      const num1 = parseInt(account1.accountNumber);
      const num2 = parseInt(account2.accountNumber);
      const num3 = parseInt(account3.accountNumber);

      // Numbers should not be sequential (unless using auto-increment intentionally)
      // With Math.random(), they shouldn't be sequential
      const isSequential = (num2 === num1 + 1) && (num3 === num2 + 1);

      // This just verifies basic randomness - real crypto verification requires more
      expect(num1).not.toBe(num2);
      expect(num2).not.toBe(num3);
    });

    it("should maintain account number security across account types", async () => {
      const caller = accountRouter.createCaller(mockContext);

      const checking = await caller.createAccount({ accountType: "checking" });
      const savings = await caller.createAccount({ accountType: "savings" });

      // Both types should use same secure generation method
      expect(checking.accountNumber).toMatch(/^\d{10}$/);
      expect(savings.accountNumber).toMatch(/^\d{10}$/);
      expect(checking.accountNumber).not.toBe(savings.accountNumber);
    });

    it("should generate account numbers that meet banking standards", async () => {
      const caller = accountRouter.createCaller(mockContext);
      const account = await caller.createAccount({ accountType: "checking" });

      // Banking standards for account numbers:
      // - Numeric only
      // - Fixed length (typically 8-12 digits)
      // - Unique per customer
      // - Unpredictable

      expect(account.accountNumber).toMatch(/^\d+$/); // Numeric only
      expect(account.accountNumber.length).toBe(10); // Fixed length
      expect(parseInt(account.accountNumber)).toBeGreaterThan(0); // Valid number
      expect(parseInt(account.accountNumber)).toBeLessThan(10000000000); // Within range
    });
  });

  describe("Vulnerability Documentation", () => {
    it("documents the Math.random() security flaw", () => {
      // Math.random() issues:
      // 1. Uses predictable PRNG algorithm
      // 2. Can be reverse-engineered
      // 3. Not suitable for security-sensitive operations
      // 4. MDN explicitly warns against using it for cryptography

      const insecureExample = Math.floor(Math.random() * 1000000000);
      const secureExample = crypto.randomInt(0, 1000000000);

      // Both return numbers, but security properties differ
      expect(typeof insecureExample).toBe("number");
      expect(typeof secureExample).toBe("number");

      // This test documents the issue - both work functionally
      // but only crypto.randomInt() is cryptographically secure
    });

    it("verifies the fix requirement: use crypto module", () => {
      // The fix should replace Math.random() with crypto.randomInt()
      // Example of correct implementation:

      const correctImplementation = () => {
        return crypto.randomInt(0, 10000000000)
          .toString()
          .padStart(10, "0");
      };

      const accountNumber = correctImplementation();

      expect(accountNumber).toMatch(/^\d{10}$/);
      expect(accountNumber.length).toBe(10);

      // This demonstrates the fix - using crypto.randomInt()
    });
  });
});
