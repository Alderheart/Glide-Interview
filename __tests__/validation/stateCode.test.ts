import { describe, it, expect } from "vitest";
import { isValidStateCode, getStateCodeError, validateStateCodeForZod, validateStateCodeForReactHookForm } from "../../lib/validation/stateCode";
import { z } from "zod";

describe("VAL-203: State Code Validation", () => {
  describe("State Code Validation Helper", () => {
    describe("Valid US States (50 states)", () => {
      const validStates = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
      ];

      validStates.forEach(state => {
        it(`should accept valid state code: ${state}`, () => {
          expect(isValidStateCode(state)).toBe(true);
        });
      });
    });

    describe("Federal District and Territories", () => {
      it("should accept DC (District of Columbia)", () => {
        expect(isValidStateCode("DC")).toBe(true);
      });

      // US Territories - these might be optional based on banking requirements
      const territories = [
        { code: "AS", name: "American Samoa" },
        { code: "GU", name: "Guam" },
        { code: "MP", name: "Northern Mariana Islands" },
        { code: "PR", name: "Puerto Rico" },
        { code: "VI", name: "U.S. Virgin Islands" }
      ];

      territories.forEach(territory => {
        it(`should accept territory code: ${territory.code} (${territory.name})`, () => {
          expect(isValidStateCode(territory.code)).toBe(true);
        });
      });
    });

    describe("Invalid State Codes", () => {
      it("should reject XX (the specific invalid code from the bug report)", () => {
        expect(isValidStateCode("XX")).toBe(false);
      });

      it("should reject other common invalid 2-letter codes", () => {
        const invalidCodes = ["ZZ", "QQ", "AA", "BB", "YY", "AB", "XY"];
        invalidCodes.forEach(code => {
          expect(isValidStateCode(code)).toBe(false);
        });
      });

      it("should reject empty string", () => {
        expect(isValidStateCode("")).toBe(false);
      });

      it("should reject null", () => {
        expect(isValidStateCode(null as any)).toBe(false);
      });

      it("should reject undefined", () => {
        expect(isValidStateCode(undefined as any)).toBe(false);
      });

      it("should reject single letter", () => {
        expect(isValidStateCode("A")).toBe(false);
      });

      it("should reject three letters", () => {
        expect(isValidStateCode("ABC")).toBe(false);
      });

      it("should reject numeric codes", () => {
        expect(isValidStateCode("12")).toBe(false);
        expect(isValidStateCode("01")).toBe(false);
      });

      it("should reject special characters", () => {
        expect(isValidStateCode("A!")).toBe(false);
        expect(isValidStateCode("@#")).toBe(false);
        expect(isValidStateCode("--")).toBe(false);
      });

      it("should reject mixed alphanumeric", () => {
        expect(isValidStateCode("A1")).toBe(false);
        expect(isValidStateCode("1A")).toBe(false);
      });
    });

    describe("Case Insensitivity", () => {
      it("should accept lowercase state codes", () => {
        expect(isValidStateCode("ca")).toBe(true);
        expect(isValidStateCode("tx")).toBe(true);
        expect(isValidStateCode("ny")).toBe(true);
      });

      it("should accept mixed case state codes", () => {
        expect(isValidStateCode("Ca")).toBe(true);
        expect(isValidStateCode("Tx")).toBe(true);
        expect(isValidStateCode("nY")).toBe(true);
      });

      it("should reject invalid codes regardless of case", () => {
        expect(isValidStateCode("xx")).toBe(false);
        expect(isValidStateCode("XX")).toBe(false);
        expect(isValidStateCode("Xx")).toBe(false);
      });
    });

    describe("Error Messages", () => {
      it("should provide helpful error message for invalid codes", () => {
        const error = getStateCodeError();
        expect(error).toContain("valid US state code");
        expect(error.toLowerCase()).toMatch(/ca|ny|tx|fl/); // Should include examples
      });

      it("should provide specific message for common invalid codes", () => {
        const error = getStateCodeError("XX");
        expect(error).toContain("XX");
        expect(error).toContain("not a valid");
      });
    });
  });

  describe("Zod Integration", () => {
    it("should work with Zod schemas", () => {
      const schema = z.object({
        state: z.string().refine(validateStateCodeForZod, {
          message: getStateCodeError()
        })
      });

      // Valid state should pass
      expect(() => schema.parse({ state: "CA" })).not.toThrow();

      // Invalid state should fail
      expect(() => schema.parse({ state: "XX" })).toThrow();
    });

    it("should handle uppercase conversion properly", () => {
      const schema = z.object({
        state: z.string().toUpperCase().refine(validateStateCodeForZod, {
          message: getStateCodeError()
        })
      });

      const result = schema.parse({ state: "ca" });
      expect(result.state).toBe("CA");
    });
  });

  describe("React Hook Form Integration", () => {
    it("should provide validation function compatible with React Hook Form", () => {
      // Valid state should return true
      expect(validateStateCodeForReactHookForm("CA")).toBe(true);

      // Invalid state should return error string
      const result = validateStateCodeForReactHookForm("XX");
      expect(typeof result).toBe("string");
      expect(result).toContain("not a valid");
    });

    it("should handle case conversion in React Hook Form", () => {
      expect(validateStateCodeForReactHookForm("ca")).toBe(true);
      expect(validateStateCodeForReactHookForm("CA")).toBe(true);
      expect(validateStateCodeForReactHookForm("Ca")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle whitespace properly", () => {
      expect(isValidStateCode(" CA ")).toBe(true); // Should trim
      expect(isValidStateCode("C A")).toBe(false); // Space in middle
      expect(isValidStateCode("  ")).toBe(false); // Only spaces
    });

    it("should reject SQL injection attempts", () => {
      expect(isValidStateCode("CA' OR '1'='1")).toBe(false);
      expect(isValidStateCode("'; DROP TABLE users; --")).toBe(false);
    });

    it("should reject HTML/Script injection attempts", () => {
      expect(isValidStateCode("<script>alert('xss')</script>")).toBe(false);
      expect(isValidStateCode("<img src=x onerror=alert(1)>")).toBe(false);
    });

    it("should handle very long strings gracefully", () => {
      const longString = "A".repeat(1000);
      expect(isValidStateCode(longString)).toBe(false);
    });

    it("should handle unicode characters", () => {
      expect(isValidStateCode("ÇÅ")).toBe(false);
      expect(isValidStateCode("北京")).toBe(false);
      expect(isValidStateCode("🇺🇸")).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should validate quickly even with many calls", () => {
      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        isValidStateCode("CA");
        isValidStateCode("XX");
      }
      const end = Date.now();
      expect(end - start).toBeLessThan(100); // Should complete 10k validations in < 100ms
    });
  });


  describe("Regression Prevention", () => {
    it("should have comprehensive test coverage for all valid states", () => {
      // Ensure we're testing all 50 states + DC
      const allStatesAndDC = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
      ];

      expect(allStatesAndDC.length).toBe(51); // 50 states + DC

      allStatesAndDC.forEach(state => {
        expect(isValidStateCode(state)).toBe(true);
      });
    });

    it("should ensure XX specifically is always invalid (the original bug)", () => {
      // This is the specific case from the bug report
      expect(isValidStateCode("XX")).toBe(false);
      expect(isValidStateCode("xx")).toBe(false);
      expect(isValidStateCode("Xx")).toBe(false);
      expect(isValidStateCode("xX")).toBe(false);
    });
  });
});