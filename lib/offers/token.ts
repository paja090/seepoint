import { createHash, randomBytes } from 'node:crypto';

export function createPublicOfferToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashPublicOfferToken(token) };
}

export function hashPublicOfferToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPlausiblePublicOfferToken(token: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}
