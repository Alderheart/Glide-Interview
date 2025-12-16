/**
 * State code validation for US states and territories
 * Validates against the list of valid US postal codes
 */

// Valid US state codes - 50 states + DC + 5 territories
const VALID_STATE_CODES = new Set([
  // 50 US States
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",

  // Federal District
  "DC",

  // US Territories (commonly accepted in banking systems)
  "AS", // American Samoa
  "GU", // Guam
  "MP", // Northern Mariana Islands
  "PR", // Puerto Rico
  "VI"  // U.S. Virgin Islands
]);

/**
 * Validates if a given string is a valid US state code
 * @param code - The state code to validate
 * @returns true if valid, false otherwise
 */
export function isValidStateCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Trim whitespace and convert to uppercase
  const normalizedCode = code.trim().toUpperCase();

  // Check length first for performance
  if (normalizedCode.length !== 2) {
    return false;
  }

  // Check if it's only letters (no numbers or special chars)
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return false;
  }

  // Check against the valid state codes set
  return VALID_STATE_CODES.has(normalizedCode);
}

/**
 * Gets an appropriate error message for invalid state codes
 * @param code - The invalid code that was entered (optional)
 * @returns Error message string
 */
export function getStateCodeError(code?: string): string {
  if (code && code.trim().toUpperCase() === "XX") {
    return "'XX' is not a valid US state code. Please enter a valid 2-letter state code (e.g., CA, NY, TX, FL)";
  }

  if (code && code.trim().length === 2) {
    return `'${code.trim().toUpperCase()}' is not a valid US state code. Please enter a valid 2-letter state code (e.g., CA, NY, TX, FL)`;
  }

  return "Please enter a valid US state code (e.g., CA, NY, TX, FL)";
}

/**
 * Validation function for use with Zod schemas
 * @param code - The state code to validate
 * @returns true if valid, false otherwise
 */
export function validateStateCodeForZod(code: string): boolean {
  return isValidStateCode(code);
}

/**
 * Validation function for use with React Hook Form
 * Returns true if valid, or an error message if invalid
 * @param code - The state code to validate
 * @returns true or error message string
 */
export function validateStateCodeForReactHookForm(code: string): true | string {
  if (isValidStateCode(code)) {
    return true;
  }
  return getStateCodeError(code);
}

/**
 * Get a list of all valid state codes (useful for dropdowns)
 * @returns Array of valid state codes sorted alphabetically
 */
export function getAllValidStateCodes(): string[] {
  return Array.from(VALID_STATE_CODES).sort();
}

/**
 * Get state codes grouped by type
 * @returns Object with states, federal district, and territories
 */
export function getStateCodesByType() {
  return {
    states: [
      "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
      "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
      "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
      "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
      "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    ],
    federalDistrict: ["DC"],
    territories: ["AS", "GU", "MP", "PR", "VI"]
  };
}