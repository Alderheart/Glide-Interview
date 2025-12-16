import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { encryptSSN } from "@/lib/encryption/ssn";
import { validatePassword } from "@/lib/validation/password";
import { validateStateCodeForZod, getStateCodeError } from "@/lib/validation/stateCode";
import { zodPhoneNumberValidator, getPhoneNumberError, validatePhoneNumber } from "@/lib/validation/phoneNumber";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        password: z.string()
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
          }, "Password cannot contain repeated characters"),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().refine(zodPhoneNumberValidator, (val) => ({
          message: getPhoneNumberError(val)
        })),
        dateOfBirth: z.string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .refine((date) => {
            const parsedDate = new Date(date);
            return !isNaN(parsedDate.getTime()) && date === parsedDate.toISOString().split('T')[0];
          }, "Please enter a valid date of birth")
          .refine((date) => {
            const birthDate = new Date(date);
            const today = new Date();
            // First check if date is in the future
            if (birthDate >= today) {
              return false;
            }
            return true;
          }, "Date of birth cannot be in the future")
          .refine((date) => {
            const birthDate = new Date(date);
            const today = new Date();
            // Only check age if date is not in future
            if (birthDate >= today) {
              return true; // Skip age check for future dates
            }
            const age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();
            const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
            return actualAge >= 18;
          }, "You must be at least 18 years old")
          .refine((date) => {
            const birthDate = new Date(date);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            return age <= 120;
          }, "Please enter a valid date of birth"),
        ssn: z.string().regex(/^\d{9}$/),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().toUpperCase().refine(validateStateCodeForZod, {
          message: getStateCodeError(),
        }),
        zipCode: z.string().regex(/^\d{5}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Encrypt the SSN before storing
      const encryptedSSN = encryptSSN(input.ssn);

      // Normalize phone number to E.164 format
      const phoneValidation = validatePhoneNumber(input.phoneNumber);
      const normalizedPhone = phoneValidation.normalized || input.phoneNumber;

      await db.insert(users).values({
        ...input,
        phoneNumber: normalizedPhone,
        ssn: encryptedSSN,
        password: hashedPassword,
      });

      // Fetch the created user
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Set cookie
      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      return { user: { ...user, password: undefined, ssn: undefined }, token };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Clean up expired sessions for all users (housekeeping)
      const now = new Date().toISOString();
      await db.delete(sessions).where(lt(sessions.expiresAt, now));

      // Invalidate all existing sessions for this user
      // This ensures only one active session per user at a time
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      return { user: { ...user, password: undefined, ssn: undefined }, token };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) {
      // Delete session from database
      let token: string | undefined;
      if ("cookies" in ctx.req) {
        token = (ctx.req as any).cookies.session;
      } else {
        const cookieHeader = ctx.req.headers.get?.("cookie") || (ctx.req.headers as any).cookie;
        token = cookieHeader
          ?.split("; ")
          .find((c: string) => c.startsWith("session="))
          ?.split("=")[1];
      }
      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }
    }

    if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    } else {
      (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }

    return { success: true, message: ctx.user ? "Logged out successfully" : "No active session" };
  }),

  // New endpoint to logout from all devices
  logoutAll: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to logout from all devices",
      });
    }

    // Delete all sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, ctx.user.id));

    // Clear the current session cookie
    if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    } else {
      (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }

    return {
      success: true,
      message: "Successfully logged out from all devices"
    };
  }),

  // Optional endpoint to view active sessions (for transparency)
  getActiveSessions: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view active sessions",
      });
    }

    const activeSessions = await db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, ctx.user.id),
          gt(sessions.expiresAt, new Date().toISOString())
        )
      );

    return {
      sessions: activeSessions,
      count: activeSessions.length,
    };
  }),
});
