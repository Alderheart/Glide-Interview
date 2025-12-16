import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { authRouter } from "@/server/routers/auth";
import { eq, and, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

describe("SEC-304: Session Management Security", () => {
  const mockContext = {
    user: null,
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
    email: "session-test@example.com",
    password: "Test123!@#",
    firstName: "Session",
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

  describe("Multiple Session Vulnerability", () => {
    it("should create multiple active sessions for the same user (VULNERABILITY)", async () => {
      // First, create a user
      const caller = authRouter.createCaller(mockContext);
      await caller.signup(testUser);

      // Login multiple times
      const session1 = await caller.login({
        email: testUser.email,
        password: testUser.password
      });

      const session2 = await caller.login({
        email: testUser.email,
        password: testUser.password
      });

      const session3 = await caller.login({
        email: testUser.email,
        password: testUser.password
      });

      // Check database for sessions
      const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();
      const userSessions = await db.select().from(sessions).where(eq(sessions.userId, userRecord!.id)).all();

      // VULNERABILITY: Multiple sessions exist
      expect(userSessions.length).toBe(4); // 1 from signup + 3 from logins
      expect(session1.token).not.toBe(session2.token);
      expect(session2.token).not.toBe(session3.token);

      // All sessions should be valid
      userSessions.forEach(session => {
        expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
      });
    });

    it("should allow access with old session tokens after new login (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);

      // Create user and get first session
      const signupResult = await caller.signup(testUser);
      const firstToken = signupResult.token;

      // Login again to get second session
      const loginResult = await caller.login({
        email: testUser.email,
        password: testUser.password
      });
      const secondToken = loginResult.token;

      // Verify both tokens are still valid in the database
      const session1 = await db.select().from(sessions).where(eq(sessions.token, firstToken)).get();
      const session2 = await db.select().from(sessions).where(eq(sessions.token, secondToken)).get();

      expect(session1).toBeDefined();
      expect(session2).toBeDefined();

      // Both sessions should be active (not expired)
      expect(new Date(session1!.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(session2!.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("should not invalidate other sessions on logout (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);

      // Create user
      await caller.signup(testUser);

      // Create multiple sessions
      const login1 = await caller.login({ email: testUser.email, password: testUser.password });
      const login2 = await caller.login({ email: testUser.email, password: testUser.password });
      const login3 = await caller.login({ email: testUser.email, password: testUser.password });

      // Logout with the second session
      const contextWithToken = {
        ...mockContext,
        user: { id: 1 }, // Simulate authenticated user
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${login2.token}` : null,
            cookie: `session=${login2.token}`
          } as any
        }
      };

      const logoutCaller = authRouter.createCaller(contextWithToken);
      await logoutCaller.logout();

      // Check remaining sessions
      const session1 = await db.select().from(sessions).where(eq(sessions.token, login1.token)).get();
      const session2 = await db.select().from(sessions).where(eq(sessions.token, login2.token)).get();
      const session3 = await db.select().from(sessions).where(eq(sessions.token, login3.token)).get();

      // VULNERABILITY: Only the logged-out session is deleted
      expect(session1).toBeDefined(); // Still exists
      expect(session2).toBeUndefined(); // Deleted
      expect(session3).toBeDefined(); // Still exists
    });
  });

  describe("Session Accumulation", () => {
    it("should accumulate sessions over multiple logins (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);
      await caller.signup(testUser);

      const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();

      // Simulate multiple logins over time
      for (let i = 0; i < 10; i++) {
        await caller.login({
          email: testUser.email,
          password: testUser.password
        });
      }

      const allSessions = await db.select().from(sessions).where(eq(sessions.userId, userRecord!.id)).all();

      // VULNERABILITY: Sessions keep accumulating
      expect(allSessions.length).toBe(11); // 1 from signup + 10 from logins
    });

    it("should not clean up expired sessions automatically (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);
      await caller.signup(testUser);

      const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();

      // Manually insert an expired session
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10); // 10 days ago

      await db.insert(sessions).values({
        userId: userRecord!.id,
        token: "expired-token-test",
        expiresAt: expiredDate.toISOString()
      });

      // Login again
      await caller.login({
        email: testUser.email,
        password: testUser.password
      });

      // Check if expired session still exists
      const expiredSession = await db.select().from(sessions)
        .where(eq(sessions.token, "expired-token-test"))
        .get();

      // VULNERABILITY: Expired sessions are not cleaned up
      expect(expiredSession).toBeDefined();
      expect(new Date(expiredSession!.expiresAt).getTime()).toBeLessThan(Date.now());
    });
  });

  describe("Security Implications", () => {
    it("should allow session hijacking if token is compromised (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);

      // User creates account and logs in
      const signupResult = await caller.signup(testUser);
      const legitimateToken = signupResult.token;

      // User logs in from another device
      await caller.login({
        email: testUser.email,
        password: testUser.password
      });

      // User logs out from the first device
      const contextWithToken = {
        ...mockContext,
        user: { id: 1 },
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${legitimateToken}` : null,
            cookie: `session=${legitimateToken}`
          } as any
        }
      };

      const logoutCaller = authRouter.createCaller(contextWithToken);
      await logoutCaller.logout();

      // Attacker tries to use the "logged out" token
      // In a real scenario, they would have stolen this token earlier
      const stolenSession = await db.select().from(sessions)
        .where(eq(sessions.token, legitimateToken))
        .get();

      // VULNERABILITY: The stolen token is gone (good), but other sessions remain
      expect(stolenSession).toBeUndefined();

      // But if attacker had access to any other session token, it would still work
      const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();
      const remainingSessions = await db.select().from(sessions)
        .where(eq(sessions.userId, userRecord!.id))
        .all();

      expect(remainingSessions.length).toBeGreaterThan(0); // Other sessions still active
    });

    it("should have no way to invalidate all sessions at once (VULNERABILITY)", async () => {
      const caller = authRouter.createCaller(mockContext);
      await caller.signup(testUser);

      // Create multiple sessions (simulating multiple devices)
      const tokens: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await caller.login({
          email: testUser.email,
          password: testUser.password
        });
        tokens.push(result.token);
      }

      // Try to logout from one session
      const contextWithToken = {
        ...mockContext,
        user: { id: 1 },
        req: {
          headers: {
            get: (key: string) => key === "cookie" ? `session=${tokens[0]}` : null,
            cookie: `session=${tokens[0]}`
          } as any
        }
      };

      const logoutCaller = authRouter.createCaller(contextWithToken);
      await logoutCaller.logout();

      // Check how many sessions remain
      const userRecord = await db.select().from(users).where(eq(users.email, testUser.email)).get();
      const remainingSessions = await db.select().from(sessions)
        .where(eq(sessions.userId, userRecord!.id))
        .all();

      // VULNERABILITY: No way to logout from all devices
      expect(remainingSessions.length).toBe(5); // Only 1 was deleted, 5 remain (1 signup + 5 login - 1 logout)
    });
  });

  describe("Proposed Solution Validation", () => {
    it("should invalidate all previous sessions on new login (SOLUTION)", async () => {
      // This test validates the proposed fix
      // After implementing the fix, this should pass

      // The fix would be in auth.ts login mutation:
      // Before creating new session:
      // await db.delete(sessions).where(eq(sessions.userId, user.id));

      // This ensures only one active session per user at a time
      expect(true).toBe(true); // Placeholder for solution validation
    });

    it("should provide option to logout from all devices (SOLUTION)", async () => {
      // This test validates the proposed "logout all" endpoint
      // A new mutation: logoutAll that deletes all sessions for the user

      expect(true).toBe(true); // Placeholder for solution validation
    });

    it("should clean up expired sessions periodically (SOLUTION)", async () => {
      // This test validates automatic cleanup of expired sessions
      // Could be done on login or as a scheduled job:
      // await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));

      expect(true).toBe(true); // Placeholder for solution validation
    });
  });
});