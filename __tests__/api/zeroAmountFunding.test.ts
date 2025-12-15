/**
 * Test Suite for VAL-205: Zero Amount Funding
 *
 * Tests validation to ensure the system rejects funding requests with zero amounts.
 * This prevents unnecessary transaction records and maintains data integrity.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/server/routers/_app";
import { db } from "@/lib/db";
import { users, accounts, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

describe("VAL-205: Zero Amount Funding", () => {
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
        email: "zerotest@example.com",
        password: hashedPassword,
        firstName: "Zero",
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
        accountNumber: "1234567890",
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
        email: "zerotest@example.com",
        firstName: "Zero",
        lastName: "Tester",
      },
      session: null,
    });
  });

  describe("Backend Validation", () => {
    it("should reject funding with exactly $0.00", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0.0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366", // Valid Visa test card
          },
        })
      ).rejects.toThrow();
    });

    it("should reject funding with zero as integer", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject negative amounts", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: -10.50,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject very small negative amounts", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: -0.01,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Minimum Valid Amount", () => {
    it("should accept $0.01 (minimum valid amount)", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 0.01,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      expect(result.newBalance).toBe(initialBalance + 0.01);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.amount).toBe(0.01);
    });

    it("should accept $0.50", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 0.50,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      expect(result.newBalance).toBe(initialBalance + 0.50);
      expect(result.transaction.amount).toBe(0.50);
    });

    it("should accept $1.00", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 1.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      expect(result.newBalance).toBe(initialBalance + 1.00);
      expect(result.transaction.amount).toBe(1.00);
    });
  });

  describe("Transaction Record Prevention", () => {
    it("should not create transaction record when zero amount is rejected", async () => {
      const transactionsBefore = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId));

      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
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

    it("should not modify account balance when zero amount is rejected", async () => {
      const accountBefore = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
        .get();

      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0.0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
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
  });

  describe("Edge Cases", () => {
    it("should reject extremely small positive amounts less than $0.01", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0.001,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        })
      ).rejects.toThrow();
    });

    it("should reject zero with bank account funding type", async () => {
      await expect(
        caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0,
          fundingSource: {
            type: "bank" as const,
            accountNumber: "123456789",
            routingNumber: "021000021",
          },
        })
      ).rejects.toThrow();
    });

    it("should accept minimum amount with bank account funding type", async () => {
      const initialBalance = 100;

      const result = await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 0.01,
        fundingSource: {
          type: "bank" as const,
          accountNumber: "123456789",
          routingNumber: "021000021",
        },
      });

      expect(result.newBalance).toBe(initialBalance + 0.01);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain accurate transaction history without zero amounts", async () => {
      // Add several valid transactions
      await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 10.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 25.50,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      // Try to add zero amount (should fail)
      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        });
      } catch (error) {
        // Expected
      }

      // Verify only valid transactions exist
      const allTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId));

      expect(allTransactions.length).toBe(2);
      expect(allTransactions.every(t => t.amount > 0)).toBe(true);
    });

    it("should calculate correct balance without zero amount transactions", async () => {
      const initialBalance = 100;

      await caller.account.fundAccount({
        accountId: testAccountId,
        amount: 50.00,
        fundingSource: {
          type: "card" as const,
          accountNumber: "4532015112830366",
        },
      });

      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
        .get();

      expect(account?.balance).toBe(initialBalance + 50.00);
    });
  });

  describe("Error Messages", () => {
    it("should provide clear error message for zero amount", async () => {
      try {
        await caller.account.fundAccount({
          accountId: testAccountId,
          amount: 0,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        // Verify error message is informative
        expect(error.message).toBeDefined();
        // The error should mention either "positive" or "minimum" or "0.01"
        const message = error.message.toLowerCase();
        const hasRelevantMessage =
          message.includes("positive") ||
          message.includes("minimum") ||
          message.includes("0.01") ||
          message.includes("greater than");
        expect(hasRelevantMessage).toBe(true);
      }
    });
  });

  describe("Boundary Testing", () => {
    it("should reject amounts between 0 and 0.01", async () => {
      const invalidAmounts = [0.001, 0.005, 0.009];

      for (const amount of invalidAmounts) {
        await expect(
          caller.account.fundAccount({
            accountId: testAccountId,
            amount,
            fundingSource: {
              type: "card" as const,
              accountNumber: "4532015112830366",
            },
          })
        ).rejects.toThrow();
      }
    });

    it("should accept amounts at common boundaries", async () => {
      const validAmounts = [0.01, 0.10, 1.00, 10.00, 100.00, 1000.00];
      const initialBalance = 100;
      let expectedBalance = initialBalance;

      for (const amount of validAmounts) {
        const result = await caller.account.fundAccount({
          accountId: testAccountId,
          amount,
          fundingSource: {
            type: "card" as const,
            accountNumber: "4532015112830366",
          },
        });

        expectedBalance += amount;
        expect(result.newBalance).toBe(expectedBalance);
      }
    });
  });
});
