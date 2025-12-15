import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Get or generate the encryption key from environment
 * In production, this should come from a secure environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Run `npm run generate-key` to create one for development.'
    );
  }

  // Convert hex string to Buffer
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). ' +
      'Run `npm run generate-key` to generate a valid key.'
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a Social Security Number
 * @param plainSSN - The plain text SSN (9 digits)
 * @returns Encrypted string in format: iv:encryptedData:authTag (base64 encoded)
 */
export function encryptSSN(plainSSN: string): string {
  if (!plainSSN || !/^\d{9}$/.test(plainSSN)) {
    throw new Error('Invalid SSN format. Must be 9 digits.');
  }

  const key = getEncryptionKey();

  // Generate a random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the SSN
  const encrypted = Buffer.concat([
    cipher.update(plainSSN, 'utf8'),
    cipher.final()
  ]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Combine iv, encrypted data, and auth tag
  // Format: base64(iv):base64(encryptedData):base64(authTag)
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    authTag.toString('base64')
  ].join(':');
}

/**
 * Decrypt a Social Security Number
 * @param encryptedSSN - The encrypted SSN string
 * @returns The decrypted SSN
 */
export function decryptSSN(encryptedSSN: string): string {
  if (!encryptedSSN || !encryptedSSN.includes(':')) {
    throw new Error('Invalid encrypted SSN format');
  }

  const key = getEncryptionKey();

  // Parse the encrypted data
  const parts = encryptedSSN.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted SSN format');
  }

  const [ivBase64, encryptedBase64, authTagBase64] = parts;

  // Convert from base64
  const iv = Buffer.from(ivBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Failed to decrypt SSN. The data may be corrupted or tampered with.');
  }
}

/**
 * Mask an SSN for display (shows only last 4 digits)
 * @param ssn - Either encrypted or plain SSN
 * @returns Masked format: XXX-XX-1234
 */
export function maskSSN(ssn: string): string {
  if (!ssn) {
    return 'XXX-XX-XXXX';
  }

  let plainSSN: string;

  // Check if it's encrypted (contains colons)
  if (ssn.includes(':')) {
    try {
      plainSSN = decryptSSN(ssn);
    } catch {
      return 'XXX-XX-XXXX';
    }
  } else {
    plainSSN = ssn;
  }

  // Validate it's 9 digits
  if (!/^\d{9}$/.test(plainSSN)) {
    return 'XXX-XX-XXXX';
  }

  // Return masked format: XXX-XX-1234
  const last4 = plainSSN.slice(-4);
  return `XXX-XX-${last4}`;
}

/**
 * Check if a string is an encrypted SSN
 * @param value - The value to check
 * @returns True if the value appears to be an encrypted SSN
 */
export function isEncryptedSSN(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Check for our encryption format: base64:base64:base64
  const parts = value.split(':');
  if (parts.length !== 3) {
    return false;
  }

  // Verify each part is valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => base64Regex.test(part));
}