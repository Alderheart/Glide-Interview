/**
 * Password validation helper for VAL-208
 * Enforces strong password requirements for security
 */

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a password against security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No sequential patterns (4+ consecutive characters)
 * - No repeated characters (4+ same character)
 */
export function validatePassword(password: string): PasswordValidationResult {
  // Check minimum length
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters" };
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one uppercase letter" };
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one lowercase letter" };
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one number" };
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one special character" };
  }

  // Check for sequential numbers (1234, 5678, etc.)
  const sequentialNumbers = /(?:0123|1234|2345|3456|4567|5678|6789|7890)/;
  if (sequentialNumbers.test(password)) {
    return { isValid: false, error: "Password cannot contain sequential patterns" };
  }

  // Check for reversed sequential numbers (4321, 8765, etc.)
  const reversedNumbers = /(?:3210|4321|5432|6543|7654|8765|9876|0987)/;
  if (reversedNumbers.test(password)) {
    return { isValid: false, error: "Password cannot contain sequential patterns" };
  }

  // Check for keyboard patterns (qwerty, asdfgh, etc.)
  const keyboardPatterns = /(?:qwert|werty|asdfg|sdfgh|zxcvb|xcvbn)/i;
  if (keyboardPatterns.test(password)) {
    return { isValid: false, error: "Password cannot contain sequential patterns" };
  }

  // Check for sequential letters (abcd, efgh, etc.)
  const lowerPassword = password.toLowerCase();
  for (let i = 0; i < lowerPassword.length - 3; i++) {
    const charCode = lowerPassword.charCodeAt(i);
    // Check if this is a letter
    if (charCode >= 97 && charCode <= 122) {
      // Check for 4 consecutive letters
      if (
        lowerPassword.charCodeAt(i + 1) === charCode + 1 &&
        lowerPassword.charCodeAt(i + 2) === charCode + 2 &&
        lowerPassword.charCodeAt(i + 3) === charCode + 3
      ) {
        return { isValid: false, error: "Password cannot contain sequential patterns" };
      }
    }
  }

  // Check for 4+ repeated characters (aaaa, 1111, etc.)
  if (/(.)\1{3,}/.test(password)) {
    return { isValid: false, error: "Password cannot contain repeated characters" };
  }

  return { isValid: true };
}

/**
 * Creates a Zod-compatible refinement function for password validation
 */
export function passwordRefinement(password: string): boolean {
  return validatePassword(password).isValid;
}

/**
 * Gets all password validation errors at once (for detailed feedback)
 */
export function getPasswordErrors(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Check for sequential patterns
  const sequentialNumbers = /(?:0123|1234|2345|3456|4567|5678|6789|7890)/;
  const reversedNumbers = /(?:3210|4321|5432|6543|7654|8765|9876|0987)/;
  if (sequentialNumbers.test(password) || reversedNumbers.test(password)) {
    errors.push("Password cannot contain sequential patterns");
  }

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
        errors.push("Password cannot contain sequential patterns");
        break;
      }
    }
  }

  // Check for repeated characters
  if (/(.)\1{3,}/.test(password)) {
    errors.push("Password cannot contain repeated characters");
  }

  return errors;
}