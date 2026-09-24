import 'server-only';
import { prisma } from '@/lib/db';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';

const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'seznam.cz',
  'email.cz',
  'post.cz',
  'spoluzaci.cz',
  'centrum.cz',
  'atlas.cz',
  'volny.cz',
  'tiscali.cz',
  'outlook.com',
  ' outlook.cz',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
]);

export type ClientLogoRecord = {
  id: string;
  organizationId?: string | null;
  name?: string | null;
  normalizedName?: string | null;
  companyId?: string | null;
  logoDriveFileId?: string | null;
  logoFileName?: string | null;
  logoMimeType?: string | null;
  website?: string | null;
  email?: string | null;
};

export function extractClientWebsiteDomain(website?: string | null, email?: string | null): string | null {
  if (website && website.trim()) {
    const clean = website
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .trim();
    if (clean && clean.includes('.') && !FREEMAIL_DOMAINS.has(clean)) {
      return clean;
    }
  }

  if (email && email.includes('@')) {
    const domain = email
      .trim()
      .toLowerCase()
      .split('@')[1]
      ?.split(/[\s,;>)]+/)[0]
      ?.replace(/^www\./i, '')
      ?.trim();
    if (domain && domain.includes('.') && !FREEMAIL_DOMAINS.has(domain)) {
      return domain;
    }
  }

  return null;
}

export function hasResolvableClientLogo(client?: {
  logoDriveFileId?: string | null;
  website?: string | null;
  email?: string | null;
} | null): boolean {
  if (!client) return false;
  if (client.logoDriveFileId && client.logoDriveFileId.trim()) return true;
  return Boolean(extractClientWebsiteDomain(client.website, client.email));
}

export async function enrichClientLogoFromSiblings<T extends ClientLogoRecord>(client: T): Promise<T> {
  if (client.logoDriveFileId && client.logoDriveFileId.trim()) {
    return client;
  }

  try {
    const orConditions: Array<Record<string, unknown>> = [];
    if (client.companyId && client.companyId.trim()) {
      orConditions.push({ companyId: client.companyId.trim() });
    }
    if (client.normalizedName && client.normalizedName.trim()) {
      orConditions.push({ normalizedName: client.normalizedName.trim() });
    }
    if (client.name && client.name.trim()) {
      orConditions.push({ name: { equals: client.name.trim(), mode: 'insensitive' } });
    }

    if (orConditions.length === 0) return client;

    const sibling = await prisma.client.findFirst({
      where: {
        ...(client.organizationId ? { organizationId: client.organizationId } : {}),
        OR: orConditions,
        AND: [
          {
            OR: [
              { logoDriveFileId: { not: null } },
              { website: { not: null } },
              { email: { not: null } },
            ],
          },
        ],
      },
      select: {
        logoDriveFileId: true,
        logoFileName: true,
        logoMimeType: true,
        website: true,
        email: true,
      },
      orderBy: [{ logoDriveFileId: 'desc' }, { updatedAt: 'desc' }],
    });

    if (sibling) {
      if (!client.logoDriveFileId && sibling.logoDriveFileId) {
        client.logoDriveFileId = sibling.logoDriveFileId;
        client.logoFileName = sibling.logoFileName ?? client.logoFileName;
        client.logoMimeType = sibling.logoMimeType ?? client.logoMimeType;
      }
      if (!client.website && sibling.website) {
        client.website = sibling.website;
      }
      if (!client.email && sibling.email) {
        client.email = sibling.email;
      }
    }
  } catch {
    // Ignore sibling lookup errors
  }

  return client;
}

function detectImageMimeType(buffer: Buffer, fallback?: string | null): string {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif';
  }
  const head = buffer.subarray(0, 120).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.includes('<svg')) {
    return 'image/svg+xml';
  }
  return fallback && fallback.startsWith('image/') ? fallback : 'image/png';
}

export async function fetchClientLogoAsset(
  rawClient: ClientLogoRecord,
  options?: { pdfCompatibleOnly?: boolean }
): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  dataUri: string;
} | null> {
  const client = await enrichClientLogoFromSiblings({ ...rawClient });
  const driveId = client.logoDriveFileId?.trim();

  // 1. Try stored logoDriveFileId (Data URI, HTTP URL, or Google Drive file ID)
  if (driveId) {
    try {
      let buffer: Buffer | null = null;
      let rawMime = client.logoMimeType || null;

      if (driveId.startsWith('data:')) {
        const match = driveId.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          rawMime = match[1];
          buffer = Buffer.from(match[2], 'base64');
        }
      } else if (driveId.startsWith('http://') || driveId.startsWith('https://')) {
        const res = await fetch(driveId, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          buffer = Buffer.from(await res.arrayBuffer());
          rawMime = res.headers.get('content-type') || rawMime;
        }
      } else {
        const file = await downloadPhotoFromGoogleDrive(driveId);
        if (file.ok && file.body) {
          const ab = await new Response(file.body).arrayBuffer();
          buffer = Buffer.from(ab);
          rawMime = file.headers.get('Content-Type') || rawMime;
        }
      }

      if (buffer && buffer.length > 0) {
        const mimeType = detectImageMimeType(buffer, rawMime);
        const isPdfSafe = mimeType === 'image/png' || mimeType === 'image/jpeg';
        if (!options?.pdfCompatibleOnly || isPdfSafe) {
          return {
            buffer,
            mimeType,
            fileName: client.logoFileName || 'client-logo.png',
            dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
          };
        }
      }
    } catch {
      // Fall through to website favicon resolution
    }
  }

  // 2. Fallback to website / email domain 256px PNG favicon (same source as CRM ClientHeader)
  const domain = extractClientWebsiteDomain(client.website, client.email);
  if (domain) {
    try {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
      const res = await fetch(faviconUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 0) {
          const mimeType = detectImageMimeType(buffer, 'image/png');
          const isPdfSafe = mimeType === 'image/png' || mimeType === 'image/jpeg';
          if (!options?.pdfCompatibleOnly || isPdfSafe) {
            return {
              buffer,
              mimeType,
              fileName: `${domain}-logo.png`,
              dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
            };
          }
        }
      }
    } catch {
      // Ignore network error
    }
  }

  return null;
}
