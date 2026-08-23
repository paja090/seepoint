import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type OAuthState = {
  v: 1;
  organizationId: string;
  userId: string;
  provider: 'GOOGLE_DRIVE';
  nonce: string;
  expiresAt: number;
};

function encryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be a base64 encoded 32-byte key.');
  return key;
}

export function encryptIntegrationSecret(value: object, encodedKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptIntegrationSecret<T>(sealed: string, encodedKey: string): T {
  const [version, ivValue, tagValue, ciphertextValue] = sealed.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Encrypted integration secret has an invalid format.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(encodedKey), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

function stateSignature(payload: string, secret: string) {
  if (secret.length < 32) throw new Error('GOOGLE_OAUTH_STATE_SECRET must contain at least 32 characters.');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signOAuthState(state: OAuthState, secret: string) {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${stateSignature(payload, secret)}`;
}

export function verifyOAuthState(value: string, secret: string, now = Date.now()): OAuthState {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) throw new Error('OAuth state has an invalid format.');
  const expected = Buffer.from(stateSignature(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('OAuth state signature is invalid.');
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  if (state.v !== 1 || state.provider !== 'GOOGLE_DRIVE' || !state.organizationId || !state.userId || !state.nonce) throw new Error('OAuth state payload is invalid.');
  if (!Number.isFinite(state.expiresAt) || state.expiresAt < now) throw new Error('OAuth state has expired.');
  return state;
}

export function createOAuthNonce() {
  return randomBytes(32).toString('base64url');
}

