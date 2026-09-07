import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

/**
 * Derives a 32-byte Buffer key from the environment variable.
 * Supports base64 encoded 32-byte string (recommended) or falls back to SHA-256 derivation.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (envKey) {
    // Try base64 decoding first
    const buf = Buffer.from(envKey, 'base64');
    if (buf.length === 32) {
      return buf;
    }
    // If raw string of 32 chars
    if (Buffer.byteLength(envKey, 'utf8') === 32) {
      return Buffer.from(envKey, 'utf8');
    }
    // Fallback: derive 32-byte key via SHA-256
    return crypto.createHash('sha256').update(envKey).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_CREDENTIALS_ENCRYPTION_KEY není v produkčním prostředí nastaven.');
  }

  // Development / test fallback key derived deterministically
  return crypto.createHash('sha256').update('seepoint-dev-local-email-encryption-fallback-key').digest();
}

/**
 * Checks if the primary encryption secret is properly set in the environment.
 */
export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim());
}

/**
 * Encrypts a tenant credential (e.g. Resend domain-scoped sending API token)
 * using AES-256-GCM.
 * 
 * Returns string format: "ivBase64:authTagBase64:ciphertextBase64"
 */
export function encryptTenantCredential(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Chybí hodnota pro zašifrování.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an encrypted tenant credential using AES-256-GCM.
 * Validates authentication tag to ensure payload integrity (tamper detection).
 */
export function decryptTenantCredential(payload: string): string {
  if (!payload || !payload.includes(':')) {
    throw new Error('Neplatný formát zašifrovaných dat.');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Neplatná struktura zašifrovaného pověření.');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  if (iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new Error('Neplatná délka IV nebo ověřovací značky.');
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new Error('Dešifrování pověření selhalo nebo byla data poškozena.');
  }
}
