import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { luhnCheck, isAcceptedCardType } from "@/lib/validation/cardNumber";
import { validateRoutingNumber } from "@/lib/validation/routingNumber";
import { validateAmount } from "@/lib/validation/amount";

function formatAccountNumber(id: number, accountType: string): string {
  const prefix = accountType === 'checking' ? '10' : '20';
  const paddedId = id.toString().padStart(8, '0');
  return `${prefix}${paddedId}`;
}

export const accountRouter = router({
  createAccount: protectedProcedure
    .input(
      z.object({
        accountType: z.enum(["checking", "savings"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already has an account of this type
      const existingAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.accountType, input.accountType)))
        .get();

      if (existingAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a ${input.accountType} account`,
        });
      }

      // Insert account first to get auto-increment ID
      const insertResult = await db.insert(accounts).values({
        userId: ctx.user.id,
        accountNumber: "TEMP", // temporary placeholder
        accountType: input.accountType,
        balance: 0,
        status: "active",
      }).returning({ id: accounts.id });

      const accountId = insertResult[0].id;
      const accountNumber = formatAccountNumber(accountId, input.accountType);

      // Update with formatted account number
      await db.update(accounts)
        .set({ accountNumber })
        .where(eq(accounts.id, accountId));

      // Fetch the created account
      const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

      if (!account) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Account was created but could not be retrieved. Please refresh and try again.",
        });
      }

      return account;
    }),

  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts;
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.union([z.string(), z.number()]).refine((val) => {
          const result = validateAmount(val);
          return result.isValid;
        }, (val) => {
          const result = validateAmount(val);
          return { message: result.error || "Invalid amount" };
        }),
        fundingSource: z.object({
          type: z.enum(["card", "bank"]),
          accountNumber: z.string(),
          routingNumber: z.string().optional(),
        }).refine((data) => {
          // Validate routing number for bank transfers
          if (data.type === "bank") {
            const validation = validateRoutingNumber(data.routingNumber);
            if (!validation.valid) {
              return false;
            }
          }
          return true;
        }, {
          message: "Routing number is required and must be a valid 9-digit ABA routing number for bank transfers",
        }).refine((data) => {
          // Skip card validation for bank accounts
          if (data.type === "bank") {
            // Just validate it's numeric for bank accounts
            return /^\d+$/.test(data.accountNumber);
          }

          // For card accounts, validate the card number
          const cardNumber = data.accountNumber;

          // Must be only digits
          if (!/^\d+$/.test(cardNumber)) {
            return false;
          }

          // Check length (15 for Amex, 16 for others)
          const length = cardNumber.length;
          if (length !== 15 && length !== 16) {
            return false;
          }

          // Check if accepted card type
          if (!isAcceptedCardType(cardNumber)) {
            return false;
          }

          // Check Luhn algorithm
          if (!luhnCheck(cardNumber)) {
            return false;
          }

          return true;
        }, {
          message: "Invalid card number. Please check and try again",
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate and normalize the amount
      const amountValidation = validateAmount(input.amount);
      if (!amountValidation.isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: amountValidation.error || "Invalid amount",
        });
      }
      const amount = amountValidation.normalized!;

      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account is not active",
        });
      }

      // Create transaction and capture the result
      const insertResult = await db.insert(transactions).values({
        accountId: input.accountId,
        type: "deposit",
        amount,
        description: `Funding from ${input.fundingSource.type}`,
        status: "completed",
        processedAt: new Date().toISOString(),
      }).returning({ id: transactions.id });

      // Fetch the created transaction using the insert result ID
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, insertResult[0].id))
        .get();

      // Update account balance
      const newBalance = account.balance + amount;
      await db
        .update(accounts)
        .set({
          balance: newBalance,
        })
        .where(eq(accounts.id, input.accountId));

      return {
        transaction,
        newBalance: newBalance,
      };
    }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId));

      // Add accountType to each transaction without additional queries
      // Since all transactions belong to the same account we already fetched above
      const enrichedTransactions = accountTransactions.map(transaction => ({
        ...transaction,
        accountType: account.accountType,
      }));

      return enrichedTransactions;
    }),
});
