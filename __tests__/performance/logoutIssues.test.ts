import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { authRouter } from "@/server/routers/auth";
import { eq } from "drizzle-orm";

// Set encryption key for testing
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.JWT_SECRET = "test-secret-for-logout-testing";

describe("PERF-402: Logout Issues", () => {
  const testUser = {
    email: "logout-test@example.com",
    password: "Test123!@#",
    firstName: "Logout",
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
    // Clean up any existing test data
    await db.delete(sessions);
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  afterEach(async () => {
    // Clean up after tests
    await db.delete(sessions);
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe("Fixed Behavior: Proper Success/Failure Reporting", () => {
    it("should report failure when no user is logged in (FIXED)", async () => {
      // Create context with no user (not authenticated)
      const mockContext = {
        user: null, // No user authenticated
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? "" : null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const caller = authRouter.createCaller(mockContext);

      // Attempt to logout when not logged in
      const result = await caller.logout();

      // FIXED: Now returns success: false when not logged in
      expect(result.success).toBe(false);
      expect(result.message).toBe("No active session to logout from");
      expect(result.code).toBe("NO_SESSION");
    });

    it("should report failure when session doesn't exist in database (FIXED)", async () => {
      // Create a user first
      const signupContext = {
        user: null,
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

      // Manually delete the session from database (simulating session already deleted)
      await db.delete(sessions).where(eq(sessions.token, signupResult.token));

      // Now try to logout with a token that doesn't exist in DB
      const logoutContext = {
        user: { id: signupResult.user.id }, // User context exists (from JWT validation)
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

      // FIXED: Reports failure when session doesn't exist
      expect(result.success).toBe(false);
      expect(result.message).toBe("Session not found in database");
      expect(result.code).toBe("SESSION_NOT_FOUND");

      // Verify the session was indeed already deleted
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeUndefined();
    });

    it("should report failure with invalid/malformed token (FIXED)", async () => {
      const mockContext = {
        user: null, // No valid user (token validation would have failed)
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? "session=invalid-token-12345" : null,
            cookie: "session=invalid-token-12345"
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const caller = authRouter.createCaller(mockContext);
      const result = await caller.logout();

      // FIXED: Reports failure for invalid token
      expect(result.success).toBe(false);
      expect(result.message).toBe("No active session to logout from");
      expect(result.code).toBe("NO_SESSION");
    });

    it("should report failure when database deletion fails (FIXED)", async () => {
      // Create user and login
      const signupContext = {
        user: null,
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

      // Mock database delete to simulate failure
      const originalDelete = db.delete;
      let deleteAttempted = false;

      // @ts-ignore - Mocking for test
      db.delete = vi.fn(() => ({
        where: vi.fn(() => {
          deleteAttempted = true;
          // Don't actually delete, simulating a database error
          return Promise.resolve();
        })
      }));

      const logoutContext = {
        user: { id: signupResult.user.id },
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

      // Restore original delete
      db.delete = originalDelete;

      // FIXED: Reports failure when database operation fails
      expect(result.success).toBe(false);
      expect(deleteAttempted).toBe(true);
      expect(result.code).toBe("DELETE_FAILED");

      // Verify session still exists (delete failed)
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeDefined(); // Session still there!
    });
  });

  describe("User Experience Impact", () => {
    it("should not give users false confidence when logout fails (FIXED)", async () => {
      // Scenario: User clicks logout, sees success, but session remains active
      const signupContext = {
        user: null,
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

      // User attempts logout but something goes wrong (e.g., network issue)
      // We'll simulate by using wrong context
      const incorrectLogoutContext = {
        user: null, // Authentication middleware failed to set user
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

      const logoutCaller = authRouter.createCaller(incorrectLogoutContext);
      const result = await logoutCaller.logout();

      // FIXED: User sees failure message when logout doesn't work
      expect(result.success).toBe(false);
      expect(result.code).toBe("NO_SESSION");

      // Session is still valid in database (which is expected since logout failed)
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeDefined();
      expect(sessionCheck?.token).toBe(signupResult.token);

      // User knows logout failed and can take appropriate action
    });
  });

  describe("Expected Behavior (for fix validation)", () => {
    it("should properly indicate when logout actually succeeds", async () => {
      // This test shows what proper behavior should look like
      const signupContext = {
        user: null,
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

      // Proper logout with correct context
      const logoutContext = {
        user: { id: signupResult.user.id },
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

      // Now returns success with proper validation
      expect(result.success).toBe(true);
      expect(result.message).toBe("Logged out successfully");
      expect(result.code).toBe("SUCCESS");

      // Session should be deleted
      const sessionCheck = await db.select().from(sessions)
        .where(eq(sessions.token, signupResult.token))
        .get();
      expect(sessionCheck).toBeUndefined();

      // Cookie should be cleared
      expect(logoutContext.res.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("session=;")
      );
    });

    it("should return appropriate status when no session exists", async () => {
      // What should happen when logging out without being logged in
      const mockContext = {
        user: null,
        req: {
          headers: {
            get: (key: string) => null,
          } as any
        },
        res: {
          setHeader: vi.fn(),
        } as any,
      };

      const caller = authRouter.createCaller(mockContext);
      const result = await caller.logout();

      // FIXED: Now returns success: false when no session exists
      expect(result.success).toBe(false);
      expect(result.message).toBe("No active session to logout from");
      expect(result.code).toBe("NO_SESSION");
    });
  });
});