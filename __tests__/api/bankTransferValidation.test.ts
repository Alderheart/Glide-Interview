/**
 * Test Suite for VAL-207: Routing Number Optional
 *
 * Tests validation to ensure bank transfers require valid routing numbers.
 * This prevents ACH transfer failures caused by missing or invalid routing numbers.
 *
 * Key test areas:
 * 1. Backend requires routing number for bank transfers
 * 2. Routing number format validation (9 digits)
 * 3. ABA checksum validation
 * 4. Card transfers do not require routing numbers
 * 5. API bypass prevention (direct backend calls)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/server/routers/_app";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

describe("VAL-207: Routing Number Optional (Bank Transfer Validation)", () => {
  let testUserId: number;
  let testAccountId: number;
  let caller: any;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(transactions).run();
    await db.delete(accounts).run();
    await db.delete(users).run();

    // Create test user
    const hashedPassword = await hashPassword("TestPass123!");
    const userResult = await db
      .insert(users)
      .values({
        email: "routingtest@example.com",
        password: hashedPassword,
        firstName: "Routing",
        lastName: "Tester",
        dateOfBirth: "1990-01-01",
        ssn: "123-45-6789",
        address: "123 Test St",
        city: "Test City",
        state: "CA",
        zipCode: "12345",
        phoneNumber: "5555555555",
      })
      .returning({ id: users.id });

    testUserId = userResult[0].id;

    // Create test account
    const accountResult = await db
      .insert(accounts)
      .values({
        userId: testUserId,
        accountNumber: "9876543210",
        accountType: "checking",
        balance: 100,
        status: "active",
      })
      .returning({ id: accounts.id });

    testAccountId = accountResult[0].id;

    // Create authenticated caller
    caller = appRouter.createCaller({
      user: {
        id: testUserId,
        email: "routingtest@example.com",
        firstName: "Routing",
        lastName: "Tester",
      },
      session: null,
    });
  });

  describe("Routing Number Required for Bank Transfers", () => {
    it("should reject bank transfer without routing number (undefined)", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            // routingNumber is undefined
          },
        })
      ).rejects.toThrow();
    });

    it("should reject bank transfer with null routing number", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: null as any,
          },
        })
      ).rejects.toThrow();
    });

    it("should reject bank transfer with empty string routing number", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "",
          },
        })
      ).rejects.toThrow();
    });

    it("should accept bank transfer with valid routing number", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 50.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021", // Valid Chase routing number
        },
      });

      expect(result.newBalance).toBe(initialBalance + 50.00);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.amount).toBe(50.00);
      expect(result.transaction.description).toMatch(/bank/i);
    });
  });

  describe("Routing Number Format Validation", () => {
    it("should reject routing number with less than 9 digits", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "12345678", // 8 digits
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with more than 9 digits", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "1234567890", // 10 digits
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with letters", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "02100002A",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with special characters", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021-000-021",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with spaces", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021 000 021",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("ABA Checksum Validation", () => {
    it("should accept routing number with valid checksum - Chase (021000021)", async () => {
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 25.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021",
        },
      });

      expect(result.newBalance).toBe(125.00);
    });

    it("should accept routing number with valid checksum - Bank of America (026009593)", async () => {
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 25.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "026009593",
        },
      });

      expect(result.newBalance).toBe(125.00);
    });

    it("should accept routing number with valid checksum - Wells Fargo (121000248)", async () => {
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 25.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "121000248",
        },
      });

      expect(result.newBalance).toBe(125.00);
    });

    it("should reject routing number with invalid checksum - off by 1", async () => {
      // Valid: 021000021, Invalid: 021000022
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021000022", // Invalid checksum
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with invalid checksum - sequential numbers", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "123456789", // Invalid checksum
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with invalid checksum - all zeros", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "000000000", // Invalid checksum
          },
        })
      ).rejects.toThrow();
    });

    it("should reject routing number with invalid checksum - all nines", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "999999999", // Invalid checksum
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Card Transfers Should Not Require Routing Number", () => {
    it("should accept card transfer without routing number", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 75.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366", // Valid Visa card
          // No routing number provided
        },
      });

      expect(result.newBalance).toBe(initialBalance + 75.00);
      expect(result.transaction.description).toMatch(/card/i);
    });

    it("should accept card transfer with undefined routing number", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 75.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "5425233430109903", // Valid Mastercard
          routingNumber: undefined,
        },
      });

      expect(result.newBalance).toBe(initialBalance + 75.00);
    });

    it("should ignore routing number for card transfers (if provided)", async () => {
      // Even if routing number is provided, it should be ignored for cards
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 50.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
          routingNumber: "021000021", // Provided but should be ignored
        },
      });

      expect(result.newBalance).toBe(initialBalance + 50.00);
    });
  });

  describe("Transaction Creation and Data Integrity", () => {
    it("should not create transaction when routing number is missing", async () => {
      const transactionsBefore = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId));

      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            // No routing number
          },
        });
      } catch (error) {
        // Expected to fail
      }

      const transactionsAfter = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId));

      expect(transactionsAfter.length).toBe(transactionsBefore.length);
    });

    it("should not modify balance when routing number is invalid", async () => {
      const accountBefore = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
        .get();

      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "123456789", // Invalid checksum
          },
        });
      } catch (error) {
        // Expected to fail
      }

      const accountAfter = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
        .get();

      expect(accountAfter?.balance).toBe(accountBefore?.balance);
    });

    it("should create transaction with valid routing number", async () => {
      await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 200.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "987654321",
          routingNumber: "111000025", // Valid Webster Bank routing
        },
      });

      const transactionsAfter = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId));

      expect(transactionsAfter.length).toBe(1);
      expect(transactionsAfter[0].amount).toBe(200.00);
      expect(transactionsAfter[0].type).toBe("deposit");
      expect(transactionsAfter[0].status).toBe("completed");
    });
  });

  describe("Multiple Valid Routing Numbers", () => {
    const validRoutingNumbers = [
      { name: "Chase", routing: "021000021" },
      { name: "Bank of America", routing: "026009593" },
      { name: "Wells Fargo", routing: "121000248" },
      { name: "Citibank", routing: "021000089" },
      { name: "Webster Bank", routing: "111000025" },
      { name: "TD Bank", routing: "011401533" },
      { name: "BMO Harris", routing: "071000013" },
    ];

    validRoutingNumbers.forEach(({ name, routing }) => {
      it(`should accept valid routing number for ${name} (${routing})`, async () => {
        const result = await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 10.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: routing,
          },
        });

        expect(result.transaction).toBeDefined();
        expect(result.transaction.amount).toBe(10.00);
      });
    });
  });

  describe("API Bypass Prevention", () => {
    it("should validate routing number even when bypassing frontend", async () => {
      // Direct API call without routing number should fail
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 500.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
          },
        })
      ).rejects.toThrow();
    });

    it("should validate routing number format even from direct API call", async () => {
      // Direct API call with invalid format should fail
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 500.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "invalid",
          },
        })
      ).rejects.toThrow();
    });

    it("should validate routing number checksum even from direct API call", async () => {
      // Direct API call with invalid checksum should fail
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 500.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021000020", // Invalid checksum
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Error Messages", () => {
    it("should provide clear error message when routing number is missing", async () => {
      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
          },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
        const message = error.message.toLowerCase();
        const hasRelevantMessage =
          message.includes("routing") ||
          message.includes("required") ||
          message.includes("bank");
        expect(hasRelevantMessage).toBe(true);
      }
    });

    it("should provide clear error message when routing number is invalid", async () => {
      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "123456789", // Invalid checksum
          },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
        const message = error.message.toLowerCase();
        const hasRelevantMessage =
          message.includes("routing") ||
          message.includes("invalid") ||
          message.includes("checksum") ||
          message.includes("aba");
        expect(hasRelevantMessage).toBe(true);
      }
    });
  });

  describe("Edge Cases and Security", () => {
    it("should reject SQL injection attempt in routing number", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021000021' OR '1'='1",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject XSS attempt in routing number", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 100.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "<script>alert('xss')</script>",
          },
        })
      ).rejects.toThrow();
    });

    it("should handle large transaction amounts with valid routing number", async () => {
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 9999.99,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021",
        },
      });

      expect(result.newBalance).toBe(10099.99);
    });

    it("should handle small transaction amounts with valid routing number", async () => {
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 0.01,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021",
        },
      });

      expect(result.newBalance).toBe(100.01);
    });
  });

  describe("Mixed Funding Types", () => {
    it("should allow both card and bank transfers in sequence", async () => {
      // First, fund with card (no routing number needed)
      await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 50.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      // Then, fund with bank (routing number required)
      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 75.00,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021",
        },
      });

      expect(result.newBalance).toBe(225.00); // 100 + 50 + 75
    });

    it("should maintain separate validation rules for each funding type", async () => {
      // Card with invalid card number should fail
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 50.00,
          fundingSource: {
            type: "card" as const,
            accountNumber: "1234567890123456", // Invalid Luhn
          },
        })
      ).rejects.toThrow();

      // Bank without routing number should fail
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 50.00,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
          },
        })
      ).rejects.toThrow();
    });
  });
});
