import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContext } from "@/server/trpc";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}));

describe("Session Expiry Security (PERF-403)", () => {
  const mockUserId = 1;
  const mockToken = "test-token-123";
  const mockUser = {
    id: mockUserId,
    email: "test@example.com",
    password: "hashedPassword",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1234567890",
    dateOfBirth: "1990-01-01",
    ssn: "encrypted-ssn",
    address: "123 Test St",
    city: "TestCity",
    state: "TS",
    zipCode: "12345",
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";

    // Mock JWT verification to return our test user ID
    vi.spyOn(jwt, "verify").mockImplementation(() => ({ userId: mockUserId }));
  });

  describe("Exact Expiry Time Boundary", () => {
    it("should consider session VALID when expiry time equals current time", async () => {
      // This test should FAIL with current implementation (using >) and PASS after fix (using >=)
      const now = new Date();
      const exactExpiry = now.toISOString(); // Expiry time is exactly now

      // Mock session with exact expiry time
      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: exactExpiry,
        createdAt: "2024-01-01T00:00:00Z",
      };

      // Setup database mocks
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      // Create context with session cookie
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // EXPECTED: Session at exact expiry should be valid (with >= fix)
      // CURRENT: Session at exact expiry is invalid (with > comparison)
      // This assertion will FAIL until the fix is implemented
      expect(ctx.user).toBeTruthy();
      expect(ctx.user?.email).toBe("test@example.com");
    });

    it("should consider session INVALID when current time is after expiry", async () => {
      // This test should PASS with both current and fixed implementation
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000).toISOString(); // Expired 1 second ago

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: pastExpiry,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValueOnce(mockSession),
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // Session should be invalid (expired)
      expect(ctx.user).toBeNull();
    });

    it("should consider session VALID when expiry time is in the future", async () => {
      // This test should PASS with both current and fixed implementation
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 60000).toISOString(); // Expires in 1 minute

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: futureExpiry,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // Session should be valid
      expect(ctx.user).toBeTruthy();
      expect(ctx.user?.email).toBe("test@example.com");
    });
  });

  describe("Millisecond Precision Boundary", () => {
    it("should handle exact millisecond boundary correctly", async () => {
      // This test verifies the exact boundary condition at millisecond precision
      // Should FAIL with current (>) and PASS with fix (>=)

      // Create a specific timestamp
      const exactTime = new Date("2024-12-15T12:00:00.500Z");

      // Mock Date.now() to return the exact same time
      const originalDate = global.Date;
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(exactTime.getTime());
          } else {
            super(...args);
          }
        }
        static now() {
          return exactTime.getTime();
        }
      } as any;

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: exactTime.toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // Session at exact millisecond should be valid with >= fix
      // This will FAIL until fix is implemented
      expect(ctx.user).toBeTruthy();

      // Restore original Date
      global.Date = originalDate;
    });

    it("should be invalid one millisecond after expiry", async () => {
      // This should always be invalid (both before and after fix)
      const now = new Date();
      const expiry = new Date(now.getTime() - 1); // 1ms in the past

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: expiry.toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValueOnce(mockSession),
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      expect(ctx.user).toBeNull();
    });

    it("should be valid one millisecond before expiry", async () => {
      // This should always be valid (both before and after fix)
      const now = new Date();
      const expiry = new Date(now.getTime() + 1); // 1ms in the future

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: expiry.toISOString(),
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      expect(ctx.user).toBeTruthy();
    });
  });

  describe("Warning Zone Behavior", () => {
    it("should log warning for sessions expiring within 60 seconds", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const now = new Date();
      const expiringSoon = new Date(now.getTime() + 30000).toISOString(); // 30 seconds from now

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: expiringSoon,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      expect(consoleSpy).toHaveBeenCalledWith("Session about to expire");
      consoleSpy.mockRestore();
    });

    it("should not log warning for sessions with more than 60 seconds remaining", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const now = new Date();
      const notExpiringSoon = new Date(now.getTime() + 120000).toISOString(); // 2 minutes from now

      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: notExpiringSoon,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn()
              .mockResolvedValueOnce(mockSession) // First call returns session
              .mockResolvedValueOnce(mockUser),    // Second call returns user
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid date strings gracefully", async () => {
      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: "invalid-date",
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValueOnce(mockSession),
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // Invalid date should result in no user (safe failure)
      expect(ctx.user).toBeNull();
    });

    it("should handle missing expiry date", async () => {
      const mockSession = {
        id: 1,
        userId: mockUserId,
        token: mockToken,
        expiresAt: null,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValueOnce(mockSession),
          }),
        }),
      });
      (db.select as any).mockImplementation(selectMock);

      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === "cookie") return `session=${mockToken}`;
            return null;
          },
        },
      };

      const ctx = await createContext({
        req: mockRequest as any,
        resHeaders: new Headers(),
      });

      // Missing expiry should result in no user (safe failure)
      expect(ctx.user).toBeNull();
    });
  });
});