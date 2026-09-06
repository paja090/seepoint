import { createHash, createHmac, randomBytes } from 'node:crypto';

const OFFER_TOKEN_SECRET = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'seepoint-offer-token-salt-2026';

export function getDeterministicOfferToken(offerId: string) {
  return createHmac('sha256', OFFER_TOKEN_SECRET).update(`offer:${offerId}`).digest('base64url');
}

export function createPublicOfferToken(offerId?: string) {
  const token = offerId ? getDeterministicOfferToken(offerId) : randomBytes(32).toString('base64url');
  return { token, hash: hashPublicOfferToken(token) };
}

export function hashPublicOfferToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isPlausiblePublicOfferToken(token: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}
