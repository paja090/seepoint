import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// Legacy recovery only, checked against the stored hash. Never mint a new URL this way.
export function getDeterministicOfferToken(offerId: string, secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'seepoint-offer-token-salt-2026') {
  return createHmac('sha256', secret).update(`offer:${offerId}`).digest('base64url');
}

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

function keyFor(id: string) {
  const keys: unknown = JSON.parse(process.env.OFFER_PORTAL_KEYS || '{}');
  const encoded = keys && typeof keys === 'object' ? (keys as Record<string, unknown>)[id] : undefined;
  if (typeof encoded !== 'string') throw new Error('Portal encryption key is unavailable.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('Portal encryption key must contain 32 bytes.');
  return key;
}
export function encryptPortalToken(token: string, offerId: string) {
  const id = process.env.OFFER_PORTAL_ACTIVE_KEY;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('OFFER_PORTAL_ACTIVE_KEY is required.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(id), iv);
  cipher.setAAD(Buffer.from(`offer:${offerId}`));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [id, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function decryptPortalToken(encrypted: string, offerId: string) {
  const [id, iv, tag, ciphertext] = encrypted.split('.');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(id), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(`offer:${offerId}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
export type PortalCredential = { id: string; publicTokenHash: string | null; publicTokenEncrypted?: string | null; publicTokenRevokedAt?: Date | null };
export function recoverPortalToken(row: PortalCredential): string | null {
  if (!row.publicTokenHash || row.publicTokenRevokedAt) return null;
  if (row.publicTokenEncrypted) {
    try {
      const token = decryptPortalToken(row.publicTokenEncrypted, row.id);
      return hashPublicOfferToken(token) === row.publicTokenHash ? token : null;
    } catch { return null; }
  }
  const secrets = [process.env.NEXTAUTH_SECRET, process.env.CRON_SECRET, ...(process.env.OFFER_PORTAL_LEGACY_SECRETS ? JSON.parse(process.env.OFFER_PORTAL_LEGACY_SECRETS) as string[] : []), 'seepoint-offer-token-salt-2026'];
  for (const secret of secrets) {
    if (!secret) continue;
    const token = getDeterministicOfferToken(row.id, secret);
    if (hashPublicOfferToken(token) === row.publicTokenHash) return token;
  }
  return null;
}
export function preparePortalCredential(row: PortalCredential) {
  if (row.publicTokenRevokedAt) throw new Error('Odkaz byl bezpečnostně zneplatněn.');
  if (row.publicTokenHash) {
    const token = recoverPortalToken(row);
    if (!token) throw new Error('Původní URL nelze obnovit. Uložený odkaz nadále funguje; kontaktujte správce klíčů.');
    return { token, hash: row.publicTokenHash, encrypted: row.publicTokenEncrypted ?? encryptPortalToken(token, row.id) };
  }
  const { token, hash } = createPublicOfferToken();
  return { token, hash, encrypted: encryptPortalToken(token, row.id) };
}
