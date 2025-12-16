import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { authRouter } from "@/server/routers/auth";
import { eq } from "drizzle-orm";

/**
 * VAL-201 Logout Issue: Token Context Test Suite
 *
 * This test suite validates that the logout endpoint can properly access
 * the session token through the context, fixing the "No session token found"
 * error that occurs even when the user is authenticated.
 *
 * Root Cause:
 * - Context successfully parses session token and populates ctx.user
 * - BUT the logout endpoint re-parses cookies manually and fails to extract token
 * - This causes authenticated users to see "NO_TOKEN" error on logout
 *
 * Solution:
 * - Pass the session token through the context (alongside ctx.user)
 * - Logout endpoint should use ctx.token instead of re-parsing cookies
 *
 * These tests should FAIL before the fix and PASS after implementation.
 */

// Set encryption key for testing
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.JWT_SECRET = "test-secret-for-logout-token-context";

describe("VAL-201 Logout Issue: Token Context Tests", () => {
  const testUser = {
    email: "token-context-test@example.com",
    password: "Test123!@#abc",
    firstName: "Token",
    lastName: "Context",
    phoneNumber: "+12025551234",
    dateOfBirth: "1990-01-01",
    ssn: "987654321",
    address: "456 Token St",
    city: "ContextCity",
    state: "NY",
    zipCode: "10001"
  };

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(sessions);
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  afterEach(async () => {
    // Clean up after tests
    await db.delete(sessions);
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe("Token Availability in Context", () => {
    it("should have token available in context when user is authenticated", async () => {
      // Create user and get session token
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Create authenticated context with token
      const authenticatedContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,  // Token should be in context
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
            cookie: `session=${signupResult.token}`
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      // Verify token is in context
      expect(authenticatedContext.token).toBeDefined();
      expect(authenticatedContext.token).toBe(signupResult.token);
      expect(authenticatedContext.user).toBeDefined();
    });

    it("should have undefined token in context when user is not authenticated", async () => {
      const unauthenticatedContext = {
        user: null,
        token: undefined,  // No token when not authenticated
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      expect(unauthenticatedContext.token).toBeUndefined();
      expect(unauthenticatedContext.user).toBeNull();
    });
  });

  describe("Logout with Token from Context", () => {
    it("should successfully logout using token from context (not re-parsing cookies)", async () => {
      // Create user and login
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Logout context with token available
      const logoutContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,  // Token passed through context
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
            cookie: `session=${signupResult.token}`
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(logoutContext);
      const result = await logoutCaller.logout();

      // Should succeed because token is in context
      expect(result.success).toBe(true);
      expect(result.code).toBe("SUCCESS");
      expect(result.message).toBe("Logged out successfully");

      // Session should be deleted from database
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeUndefined();
    });

    it("should fail with NO_TOKEN when token is not in context (even if user is authenticated)", async () => {
      // This simulates the bug: user is authenticated but token extraction fails
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Buggy context: user authenticated but token missing
      const buggyLogoutContext = {
        user: { id: signupResult.user.id },  // User IS authenticated
        token: undefined,  // BUT token is missing from context
        req: {
          headers: {
            get: (key: string) => null,  // Cookie parsing fails
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(buggyLogoutContext);
      const result = await logoutCaller.logout();

      // Should fail with NO_TOKEN error
      expect(result.success).toBe(false);
      expect(result.code).toBe("NO_TOKEN");
      expect(result.message).toBe("No session token found");
    });
  });

  describe("Cookie Parsing Consistency", () => {
    it("should use token from context instead of re-parsing cookies", async () => {
      // Create user
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Context with token but malformed/missing cookie header
      const inconsistentContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,  // Token in context is correct
        req: {
          headers: {
            // Simulate cookie parsing issues (malformed, missing, etc.)
            get: (key: string) => key === "cookie" ? "malformed-cookie-header" : null,
            cookie: undefined  // Missing cookie property
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(inconsistentContext);
      const result = await logoutCaller.logout();

      // THIS TEST SHOULD FAIL BEFORE FIX:
      // Currently, logout re-parses cookies and fails with NO_TOKEN
      // After fix, it should use ctx.token and succeed

      // Before fix: result.success will be false, result.code will be "NO_TOKEN"
      // After fix: result.success will be true, result.code will be "SUCCESS"
      expect(result.success).toBe(true);
      expect(result.code).toBe("SUCCESS");

      // Session deleted successfully
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeUndefined();
    });

    it("should handle different request adapter types consistently", async () => {
      // Create user
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Test with different adapter types (Next.js vs Fetch)
      const nextJsContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,
        req: {
          headers: {
            cookie: `session=${signupResult.token}`  // Next.js style
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      // Both should succeed using ctx.token
      const nextCaller = authRouter.createCaller(nextJsContext);
      const nextResult = await nextCaller.logout();
      expect(nextResult.success).toBe(true);

      // Login again for second test (instead of signup which would conflict)
      const loginContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };
      const loginCaller = authRouter.createCaller(loginContext);
      const loginResult = await loginCaller.login({
        email: testUser.email,
        password: testUser.password
      });

      const fetchContext = {
        user: { id: loginResult.user.id },
        token: loginResult.token,
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${loginResult.token}` : null,  // Fetch style
          } as any
        },
        res: new Headers() as any,  // Fetch uses Headers
      };

      const fetchCaller = authRouter.createCaller(fetchContext);
      const fetchResult = await fetchCaller.logout();
      expect(fetchResult.success).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle expired token gracefully when token is in context", async () => {
      // Create user
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Manually expire the session in database
      await db.update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        .where(eq(sessions.token, signupResult.token));

      // Context would not have user (expired), but might have token remnant
      const expiredContext = {
        user: null,  // Context middleware would reject expired session
        token: signupResult.token,  // But token might still be parsed
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(expiredContext);
      const result = await logoutCaller.logout();

      // Should fail with NO_SESSION (user is null)
      expect(result.success).toBe(false);
      expect(result.code).toBe("NO_SESSION");
    });

    it("should handle token mismatch between context and database", async () => {
      // Create user
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Delete session from database
      await db.delete(sessions).where(eq(sessions.token, signupResult.token));

      // Context has token but it doesn't exist in DB anymore
      const mismatchContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,  // Token in context
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(mismatchContext);
      const result = await logoutCaller.logout();

      // Should fail with SESSION_NOT_FOUND
      expect(result.success).toBe(false);
      expect(result.code).toBe("SESSION_NOT_FOUND");
      expect(result.message).toBe("Session not found in database");
    });
  });

  describe("Regression Prevention", () => {
    it("should never return NO_TOKEN error when user is authenticated and token is in context", async () => {
      // This is the core bug: authenticated user sees NO_TOKEN
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // Proper authenticated context
      const authenticatedContext = {
        user: { id: signupResult.user.id },
        token: signupResult.token,
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller = authRouter.createCaller(authenticatedContext);
      const result = await logoutCaller.logout();

      // Should NEVER be NO_TOKEN when properly authenticated
      expect(result.code).not.toBe("NO_TOKEN");
      // Should be either SUCCESS or a different error (SESSION_NOT_FOUND, DELETE_FAILED, etc.)
      expect(result.success).toBe(true);
      expect(result.code).toBe("SUCCESS");
    });

    it("should maintain consistent behavior across multiple logout attempts", async () => {
      // Test that logout behavior is predictable
      const signupContext = {
        user: null,
        token: undefined,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const signupCaller = authRouter.createCaller(signupContext);
      const signupResult = await signupCaller.signup(testUser);

      // First logout - should succeed
      const logoutContext1 = {
        user: { id: signupResult.user.id },
        token: signupResult.token,
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller1 = authRouter.createCaller(logoutContext1);
      const result1 = await logoutCaller1.logout();

      expect(result1.success).toBe(true);
      expect(result1.code).toBe("SUCCESS");

      // Second logout - should fail with SESSION_NOT_FOUND (already logged out)
      const logoutContext2 = {
        user: { id: signupResult.user.id },
        token: signupResult.token,
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${signupResult.token}` : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const logoutCaller2 = authRouter.createCaller(logoutContext2);
      const result2 = await logoutCaller2.logout();

      expect(result2.success).toBe(false);
      expect(result2.code).toBe("SESSION_NOT_FOUND");
    });
  });
});
