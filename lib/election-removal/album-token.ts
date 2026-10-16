import * as crypto from 'node:crypto';

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'seepoint-campaign-album-salt-2026';
}

/**
 * Generates a deterministic HMAC token for a given campaign.
 */
export function getCampaignAlbumToken(campaignId: string): string {
  return crypto.createHmac('sha256', getSecret()).update(`campaign-album:${campaignId}`).digest('hex');
}

/**
 * Builds the URL slug: <campaignId>.<signature>
 */
export function buildCampaignAlbumSlug(campaignId: string): string {
  const token = getCampaignAlbumToken(campaignId);
  return `${campaignId}.${token.slice(0, 32)}`;
}

/**
 * Verifies a slug and returns the valid campaignId, or null if invalid.
 */
export function verifyCampaignAlbumSlug(slug: string): string | null {
  if (!slug || typeof slug !== 'string') return null;
  const parts = slug.split('.');
  if (parts.length !== 2) return null;
  const [campaignId, signature] = parts;
  if (!campaignId || !signature) return null;
  const expectedToken = getCampaignAlbumToken(campaignId);
  if (signature !== expectedToken.slice(0, 32)) return null;
  return campaignId;
}
