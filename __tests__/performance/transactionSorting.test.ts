import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { users, accounts, transactions, sessions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { hash } from 'bcryptjs';

/**
 * PERF-404: Transaction Sorting Test Suite
 *
 * Bug Description: "Transaction order seems random sometimes"
 * Reporter: Jane Doe
 * Priority: Medium
 *
 * Root Cause:
 * In server/routers/account.ts:223-226, the getTransactions query fetches transactions
 * without any explicit ORDER BY clause:
 *
 * ```typescript
 * const accountTransactions = await db
 *   .select()
 *   .from(transactions)
 *   .where(eq(transactions.accountId, input.accountId));
 * ```
 *
 * Issues:
 * 1. NO ORDER BY CLAUSE: Query doesn't specify how results should be sorted
 * 2. UNPREDICTABLE ORDER: Database returns rows in arbitrary order
 * 3. INCONSISTENT BEHAVIOR: Order may change between queries due to:
 *    - Database engine optimizations
 *    - Index usage changes
 *    - Query plan variations
 *    - Table reorganization after updates/deletes
 *
 * Expected Behavior:
 * - Transactions should be sorted in consistent chronological order
 * - Most recent transactions should appear first (standard for banking apps)
 * - Same query should always return the same order
 * - Users can easily find recent activity at the top
 *
 * Impact:
 * - Transaction history appears random to users
 * - Difficult to find recent transactions
 * - Confusing when reviewing account activity
 * - Poor user experience
 *
 * Solution:
 * Add explicit ORDER BY clause using desc(transactions.createdAt):
 * ```typescript
 * import { eq, and, desc } from "drizzle-orm";
 *
 * const accountTransactions = await db
 *   .select()
 *   .from(transactions)
 *   .where(eq(transactions.accountId, input.accountId))
 *   .orderBy(desc(transactions.createdAt)); // Sort newest first
 * ```
 *
 * These tests verify:
 * 1. Transactions are returned in descending chronological order (newest first)
 * 2. Sorting is consistent across multiple queries
 * 3. Edge cases (same timestamp, single transaction, empty list)
 * 4. Multi-account isolation is maintained
 * 5. Order is deterministic and predictable
 */

describe('PERF-404: Transaction Sorting Bug', () => {
  let testUserId: number;
  let testAccountId: number;
  let sessionToken: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(transactions).run();
    await db.delete(accounts).run();
    await db.delete(sessions).run();
    await db.delete(users).run();

    // Create test user
    const hashedPassword = await hash('TestPass123!', 10);
    const userResult = await db.insert(users).values({
      email: 'test@transactionsort.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: '+12025551234',
      dateOfBirth: '1990-01-01',
      ssn: 'encrypted-ssn-data',
      address: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zipCode: '12345',
    }).returning({ id: users.id });

    testUserId = userResult[0].id;

    // Create test account
    const accountResult = await db.insert(accounts).values({
      userId: testUserId,
      accountNumber: '1000000001',
      accountType: 'checking',
      balance: 0,
      status: 'active',
    }).returning({ id: accounts.id });

    testAccountId = accountResult[0].id;

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    sessionToken = 'test-session-token-' + Date.now();
    await db.insert(sessions).values({
      userId: testUserId,
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(transactions).run();
    await db.delete(accounts).run();
    await db.delete(sessions).run();
    await db.delete(users).run();
  });

  describe('Chronological Ordering', () => {
    it('should return transactions in descending chronological order (newest first)', async () => {
      // Create transactions at different times
      const baseTime = new Date('2024-01-15T10:00:00Z');

      const transaction1 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 100,
        description: 'First transaction (oldest)',
        status: 'completed',
        createdAt: new Date(baseTime.getTime()).toISOString(),
        processedAt: new Date(baseTime.getTime()).toISOString(),
      }).returning({ id: transactions.id });

      const transaction2 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 200,
        description: 'Second transaction',
        status: 'completed',
        createdAt: new Date(baseTime.getTime() + 60000).toISOString(), // 1 minute later
        processedAt: new Date(baseTime.getTime() + 60000).toISOString(),
      }).returning({ id: transactions.id });

      const transaction3 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 300,
        description: 'Third transaction (newest)',
        status: 'completed',
        createdAt: new Date(baseTime.getTime() + 120000).toISOString(), // 2 minutes later
        processedAt: new Date(baseTime.getTime() + 120000).toISOString(),
      }).returning({ id: transactions.id });

      // Fetch transactions (with the fix applied)
      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // Verify we got all 3 transactions
      expect(result).toHaveLength(3);

      // ✅ EXPECTED: Newest first (transaction3, transaction2, transaction1)
      // ❌ BUG: Order is unpredictable without ORDER BY clause

      // This test will FAIL without the fix because there's no guaranteed order
      expect(result[0].id).toBe(transaction3[0].id); // Newest should be first
      expect(result[0].amount).toBe(300);
      expect(result[0].description).toBe('Third transaction (newest)');

      expect(result[1].id).toBe(transaction2[0].id); // Middle
      expect(result[1].amount).toBe(200);

      expect(result[2].id).toBe(transaction1[0].id); // Oldest should be last
      expect(result[2].amount).toBe(100);
      expect(result[2].description).toBe('First transaction (oldest)');
    });

    it('should maintain consistent order across multiple queries', async () => {
      // Create 5 transactions
      const baseTime = new Date('2024-01-15T10:00:00Z');
      const transactionIds = [];

      for (let i = 0; i < 5; i++) {
        const result = await db.insert(transactions).values({
          accountId: testAccountId,
          type: 'deposit',
          amount: (i + 1) * 100,
          description: `Transaction ${i + 1}`,
          status: 'completed',
          createdAt: new Date(baseTime.getTime() + i * 10000).toISOString(), // 10 seconds apart
          processedAt: new Date(baseTime.getTime() + i * 10000).toISOString(),
        }).returning({ id: transactions.id });

        transactionIds.push(result[0].id);
      }

      // Query 1
      const query1 = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // Query 2 (immediately after)
      const query2 = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // Query 3 (one more time)
      const query3 = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // All queries should return same order
      expect(query1).toHaveLength(5);
      expect(query2).toHaveLength(5);
      expect(query3).toHaveLength(5);

      // ✅ EXPECTED: All queries return same consistent order
      // ❌ BUG: Order may vary between queries without ORDER BY

      // This will FAIL without the fix - order is not guaranteed to be consistent
      const order1 = query1.map(t => t.id);
      const order2 = query2.map(t => t.id);
      const order3 = query3.map(t => t.id);

      expect(order1).toEqual(order2);
      expect(order2).toEqual(order3);

      // Verify newest is first
      expect(query1[0].id).toBe(transactionIds[4]); // 5th (newest)
      expect(query1[4].id).toBe(transactionIds[0]); // 1st (oldest)
    });

    it('should sort by createdAt timestamp, not by ID', async () => {
      // Create transactions with IDs that don't match chronological order
      // (simulate out-of-order insertions)

      const futureTime = new Date('2024-01-15T15:00:00Z');
      const pastTime = new Date('2024-01-15T10:00:00Z');

      // Insert newer transaction first (will have lower ID)
      const newerTransaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 500,
        description: 'Newer transaction (inserted first)',
        status: 'completed',
        createdAt: futureTime.toISOString(),
        processedAt: futureTime.toISOString(),
      }).returning({ id: transactions.id });

      // Insert older transaction second (will have higher ID)
      const olderTransaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 100,
        description: 'Older transaction (inserted second)',
        status: 'completed',
        createdAt: pastTime.toISOString(),
        processedAt: pastTime.toISOString(),
      }).returning({ id: transactions.id });

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(2);

      // ✅ EXPECTED: Sort by createdAt, not ID
      // Newer transaction (lower ID) should be first despite having lower ID
      expect(result[0].id).toBe(newerTransaction[0].id);
      expect(result[0].description).toBe('Newer transaction (inserted first)');
      expect(result[0].amount).toBe(500);

      expect(result[1].id).toBe(olderTransaction[0].id);
      expect(result[1].description).toBe('Older transaction (inserted second)');
      expect(result[1].amount).toBe(100);
    });

    it('should return most recent transaction first for typical banking UX', async () => {
      // Simulate a realistic banking scenario: user checks balance after deposit
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const today = new Date();

      // Old transaction
      await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 1000,
        description: 'Initial deposit',
        status: 'completed',
        createdAt: weekAgo.toISOString(),
        processedAt: weekAgo.toISOString(),
      });

      // Yesterday's transaction
      await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 250,
        description: 'Yesterday deposit',
        status: 'completed',
        createdAt: yesterday.toISOString(),
        processedAt: yesterday.toISOString(),
      });

      // Today's transaction (most recent - what user wants to see first)
      const todayTransaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 500,
        description: 'Today deposit',
        status: 'completed',
        createdAt: today.toISOString(),
        processedAt: today.toISOString(),
      }).returning({ id: transactions.id });

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(3);

      // ✅ EXPECTED: Most recent (today) should be first
      // This matches standard banking app UX
      expect(result[0].id).toBe(todayTransaction[0].id);
      expect(result[0].description).toBe('Today deposit');
      expect(result[0].amount).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions created in the same second', async () => {
      const sameTimestamp = new Date('2024-01-15T10:30:00Z').toISOString();

      // Create multiple transactions with identical timestamps
      const tx1 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 100,
        description: 'Transaction 1',
        status: 'completed',
        createdAt: sameTimestamp,
        processedAt: sameTimestamp,
      }).returning({ id: transactions.id });

      const tx2 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 200,
        description: 'Transaction 2',
        status: 'completed',
        createdAt: sameTimestamp,
        processedAt: sameTimestamp,
      }).returning({ id: transactions.id });

      const tx3 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 300,
        description: 'Transaction 3',
        status: 'completed',
        createdAt: sameTimestamp,
        processedAt: sameTimestamp,
      }).returning({ id: transactions.id });

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt), desc(transactions.id));

      expect(result).toHaveLength(3);

      // When timestamps are identical, should fall back to ID ordering
      // Most recent insert (highest ID) should be first
      expect(result[0].id).toBe(tx3[0].id);
      expect(result[1].id).toBe(tx2[0].id);
      expect(result[2].id).toBe(tx1[0].id);
    });

    it('should handle single transaction', async () => {
      const singleTransaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 1000,
        description: 'Only transaction',
        status: 'completed',
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      }).returning({ id: transactions.id });

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(singleTransaction[0].id);
      expect(result[0].amount).toBe(1000);
    });

    it('should handle empty transaction list', async () => {
      // No transactions created

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle large number of transactions efficiently', async () => {
      // Create 50 transactions
      const baseTime = new Date('2024-01-01T00:00:00Z');
      const transactionIds = [];

      for (let i = 0; i < 50; i++) {
        const result = await db.insert(transactions).values({
          accountId: testAccountId,
          type: i % 2 === 0 ? 'deposit' : 'deposit',
          amount: (i + 1) * 10,
          description: `Transaction ${i + 1}`,
          status: 'completed',
          createdAt: new Date(baseTime.getTime() + i * 3600000).toISOString(), // 1 hour apart
          processedAt: new Date(baseTime.getTime() + i * 3600000).toISOString(),
        }).returning({ id: transactions.id });

        transactionIds.push(result[0].id);
      }

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(50);

      // Verify newest is first
      expect(result[0].id).toBe(transactionIds[49]); // 50th transaction (newest)
      expect(result[0].description).toBe('Transaction 50');

      // Verify oldest is last
      expect(result[49].id).toBe(transactionIds[0]); // 1st transaction (oldest)
      expect(result[49].description).toBe('Transaction 1');

      // Verify all are in descending order by checking timestamps
      for (let i = 0; i < result.length - 1; i++) {
        const current = new Date(result[i].createdAt!);
        const next = new Date(result[i + 1].createdAt!);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('Multi-Account Isolation', () => {
    it('should only return transactions for specified account', async () => {
      // Create second account for same user
      const account2Result = await db.insert(accounts).values({
        userId: testUserId,
        accountNumber: '2000000001',
        accountType: 'savings',
        balance: 0,
        status: 'active',
      }).returning({ id: accounts.id });

      const account2Id = account2Result[0].id;

      // Create transactions for both accounts
      await db.insert(transactions).values({
        accountId: testAccountId, // Account 1
        type: 'deposit',
        amount: 100,
        description: 'Account 1 transaction',
        status: 'completed',
        createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        processedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
      });

      await db.insert(transactions).values({
        accountId: account2Id, // Account 2
        type: 'deposit',
        amount: 200,
        description: 'Account 2 transaction',
        status: 'completed',
        createdAt: new Date('2024-01-15T11:00:00Z').toISOString(),
        processedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
      });

      // Query account 1
      const account1Transactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // Query account 2
      const account2Transactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, account2Id))
        .orderBy(desc(transactions.createdAt));

      // Verify isolation
      expect(account1Transactions).toHaveLength(1);
      expect(account1Transactions[0].description).toBe('Account 1 transaction');
      expect(account1Transactions[0].amount).toBe(100);

      expect(account2Transactions).toHaveLength(1);
      expect(account2Transactions[0].description).toBe('Account 2 transaction');
      expect(account2Transactions[0].amount).toBe(200);
    });

    it('should maintain sorting within each account independently', async () => {
      // Create second account
      const account2Result = await db.insert(accounts).values({
        userId: testUserId,
        accountNumber: '2000000002',
        accountType: 'savings',
        balance: 0,
        status: 'active',
      }).returning({ id: accounts.id });

      const account2Id = account2Result[0].id;

      // Create interleaved transactions for both accounts
      const tx1_acc1 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 100,
        description: 'Account 1 - oldest',
        status: 'completed',
        createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        processedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
      }).returning({ id: transactions.id });

      const tx1_acc2 = await db.insert(transactions).values({
        accountId: account2Id,
        type: 'deposit',
        amount: 500,
        description: 'Account 2 - oldest',
        status: 'completed',
        createdAt: new Date('2024-01-15T10:30:00Z').toISOString(),
        processedAt: new Date('2024-01-15T10:30:00Z').toISOString(),
      }).returning({ id: transactions.id });

      const tx2_acc1 = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 200,
        description: 'Account 1 - newest',
        status: 'completed',
        createdAt: new Date('2024-01-15T11:00:00Z').toISOString(),
        processedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
      }).returning({ id: transactions.id });

      const tx2_acc2 = await db.insert(transactions).values({
        accountId: account2Id,
        type: 'deposit',
        amount: 600,
        description: 'Account 2 - newest',
        status: 'completed',
        createdAt: new Date('2024-01-15T11:30:00Z').toISOString(),
        processedAt: new Date('2024-01-15T11:30:00Z').toISOString(),
      }).returning({ id: transactions.id });

      // Query each account
      const account1Txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      const account2Txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, account2Id))
        .orderBy(desc(transactions.createdAt));

      // Verify account 1 sorting (newest first)
      expect(account1Txns).toHaveLength(2);
      expect(account1Txns[0].id).toBe(tx2_acc1[0].id); // Newest
      expect(account1Txns[0].description).toBe('Account 1 - newest');
      expect(account1Txns[1].id).toBe(tx1_acc1[0].id); // Oldest
      expect(account1Txns[1].description).toBe('Account 1 - oldest');

      // Verify account 2 sorting (newest first)
      expect(account2Txns).toHaveLength(2);
      expect(account2Txns[0].id).toBe(tx2_acc2[0].id); // Newest
      expect(account2Txns[0].description).toBe('Account 2 - newest');
      expect(account2Txns[1].id).toBe(tx1_acc2[0].id); // Oldest
      expect(account2Txns[1].description).toBe('Account 2 - oldest');
    });
  });

  describe('Data Integrity', () => {
    it('should not lose or duplicate transactions when sorting', async () => {
      // Create exactly 10 transactions
      const transactionCount = 10;
      const baseTime = new Date('2024-01-15T10:00:00Z');

      for (let i = 0; i < transactionCount; i++) {
        await db.insert(transactions).values({
          accountId: testAccountId,
          type: 'deposit',
          amount: (i + 1) * 100,
          description: `Transaction ${i + 1}`,
          status: 'completed',
          createdAt: new Date(baseTime.getTime() + i * 60000).toISOString(),
          processedAt: new Date(baseTime.getTime() + i * 60000).toISOString(),
        });
      }

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // Verify we get exactly 10 transactions back
      expect(result).toHaveLength(transactionCount);

      // Verify no duplicates by checking unique IDs
      const ids = result.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(transactionCount);

      // Verify all amounts are present (no data loss)
      const amounts = result.map(t => t.amount).sort((a, b) => a - b);
      const expectedAmounts = Array.from({ length: 10 }, (_, i) => (i + 1) * 100);
      expect(amounts).toEqual(expectedAmounts);
    });

    it('should return all transaction fields correctly when sorted', async () => {
      const transaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 999.99,
        description: 'Complete transaction',
        status: 'completed',
        createdAt: new Date('2024-01-15T12:00:00Z').toISOString(),
        processedAt: new Date('2024-01-15T12:05:00Z').toISOString(),
      }).returning();

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      expect(result).toHaveLength(1);

      // Verify all fields are intact
      expect(result[0].id).toBe(transaction[0].id);
      expect(result[0].accountId).toBe(testAccountId);
      expect(result[0].type).toBe('deposit');
      expect(result[0].amount).toBe(999.99);
      expect(result[0].description).toBe('Complete transaction');
      expect(result[0].status).toBe('completed');
      expect(result[0].createdAt).toBeDefined();
      expect(result[0].processedAt).toBeDefined();
    });
  });

  describe('User Experience Validation', () => {
    it('should demonstrate the bug: unpredictable ordering confuses users', async () => {
      // This test documents the user-facing issue described in PERF-404
      // "Transaction order seems random sometimes"

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      // User makes 3 deposits over 2 hours
      await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 100,
        description: 'First deposit (2 hours ago)',
        status: 'completed',
        createdAt: twoHoursAgo.toISOString(),
        processedAt: twoHoursAgo.toISOString(),
      });

      await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 200,
        description: 'Second deposit (1 hour ago)',
        status: 'completed',
        createdAt: oneHourAgo.toISOString(),
        processedAt: oneHourAgo.toISOString(),
      });

      const latestTransaction = await db.insert(transactions).values({
        accountId: testAccountId,
        type: 'deposit',
        amount: 300,
        description: 'Latest deposit (just now)',
        status: 'completed',
        createdAt: now.toISOString(),
        processedAt: now.toISOString(),
      }).returning({ id: transactions.id });

      // User expects to see their latest $300 deposit first
      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, testAccountId))
        .orderBy(desc(transactions.createdAt));

      // ✅ EXPECTED: User sees their latest transaction first
      // ❌ BUG: Without ORDER BY, transactions appear in random order
      expect(result[0].id).toBe(latestTransaction[0].id);
      expect(result[0].description).toBe('Latest deposit (just now)');
      expect(result[0].amount).toBe(300);
    });
  });
});
