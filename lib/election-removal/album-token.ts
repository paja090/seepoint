import 'server-only';
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

/**
 * Generates deterministic HMAC signature for a surface client album.
 */
export function getSurfaceAlbumToken(organizationId: string, clientName: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`surface-album:${organizationId}:${clientName.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Builds the URL slug for carrier surface inspection album:
 * surface.<organizationId>.<encodedClient>.<signature>
 */
export function buildSurfaceAlbumSlug(organizationId: string, clientName: string): string {
  const token = getSurfaceAlbumToken(organizationId, clientName);
  const encodedClient = Buffer.from(clientName.trim(), 'utf8').toString('base64url');
  return `surface.${organizationId}.${encodedClient}.${token.slice(0, 32)}`;
}

/**
 * Verifies a surface album slug and returns { organizationId, clientName } or null.
 */
export function verifySurfaceAlbumSlug(slug: string): { organizationId: string; clientName: string } | null {
  if (!slug || typeof slug !== 'string' || !slug.startsWith('surface.')) return null;
  const parts = slug.split('.');
  if (parts.length !== 4) return null;
  const [, organizationId, encodedClient, signature] = parts;
  if (!organizationId || !encodedClient || !signature) return null;
  let clientName: string;
  try {
    clientName = Buffer.from(encodedClient, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expectedToken = getSurfaceAlbumToken(organizationId, clientName);
  if (signature !== expectedToken.slice(0, 32)) return null;
  return { organizationId, clientName };
}
