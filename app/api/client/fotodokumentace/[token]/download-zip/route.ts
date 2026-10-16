import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterPublicCampaignAlbumTenant } from '@/lib/public-tenant';
import { verifyCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function buildZipArchive(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = f.data;
    const crc = crc32(dataBuf);
    const len = dataBuf.length;

    // Local file header (30 bytes + filename length)
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); // signature
    h.writeUInt16LE(20, 4); // min version
    h.writeUInt16LE(0, 6); // flags
    h.writeUInt16LE(0, 8); // compression: 0 = store
    h.writeUInt16LE(0, 10); // mod time
    h.writeUInt16LE(0, 12); // mod date
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(len, 18); // compressed size
    h.writeUInt32LE(len, 22); // uncompressed size
    h.writeUInt16LE(nameBuf.length, 26);
    h.writeUInt16LE(0, 28); // extra field length

    parts.push(h, nameBuf, dataBuf);

    // Central directory header (46 bytes + filename length)
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); // signature
    c.writeUInt16LE(20, 4); // version made by
    c.writeUInt16LE(20, 6); // version needed
    c.writeUInt16LE(0, 8); // flags
    c.writeUInt16LE(0, 10); // compression: store
    c.writeUInt16LE(0, 12); // mod time
    c.writeUInt16LE(0, 14); // mod date
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(len, 20); // compressed size
    c.writeUInt32LE(len, 24); // uncompressed size
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt16LE(0, 30); // extra len
    c.writeUInt16LE(0, 32); // comment len
    c.writeUInt16LE(0, 34); // disk start
    c.writeUInt16LE(0, 36); // internal attr
    c.writeUInt32LE(0, 38); // external attr
    c.writeUInt32LE(offset, 42); // offset of local header

    central.push(c, nameBuf);
    offset += h.length + nameBuf.length + dataBuf.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  // End of central directory record (22 bytes)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8); // entries on disk
  end.writeUInt16LE(files.length, 10); // total entries
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...central, end]);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const campaignId = verifyCampaignAlbumSlug(token);
    if (!campaignId) {
      return NextResponse.json({ error: 'Neplatný token.' }, { status: 400 });
    }

    const campaign = await enterPublicCampaignAlbumTenant(token);
    if (!campaign) {
      return NextResponse.json({ error: 'Album nebylo nalezeno.' }, { status: 404 });
    }

    const url = new URL(req.url);
    const monthFilter = url.searchParams.get('month'); // "2026-10"
    const typeFilter = url.searchParams.get('type');
    const photoIdsParam = url.searchParams.get('photoIds'); // comma-separated ids
    const photoIdSet = photoIdsParam ? new Set(photoIdsParam.split(',').filter(Boolean)) : null;

    const fullCampaign = await prisma.electionCampaign.findFirst({
      where: { id: campaign.id, organizationId: campaign.organizationId },
      include: {
        points: {
          include: {
            photos: {
              where: { isPrivate: false },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!fullCampaign) {
      return NextResponse.json({ error: 'Album nebylo nalezeno.' }, { status: 404 });
    }

    const zipFiles: Array<{ name: string; data: Buffer }> = [];
    let fileIndex = 1;

    for (const point of fullCampaign.points) {
      for (const photo of point.photos) {
        if (photoIdSet && !photoIdSet.has(photo.id)) continue;

        if (monthFilter) {
          const d = new Date(photo.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (ym !== monthFilter) continue;
        }

        if (typeFilter) {
          if (typeFilter === 'INSTALLATION' && !['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type)) {
            continue;
          }
          if (typeFilter === 'DEINSTALLATION' && photo.type !== 'AFTER_DEINSTALLATION') {
            continue;
          }
          if (typeFilter === 'CONTROL' && photo.type !== 'CONTROL') {
            continue;
          }
        }

        let photoBuffer: Buffer | null = null;
        if (photo.content && photo.content.length > 0) {
          photoBuffer = Buffer.from(photo.content);
        } else if (photo.url && photo.url.startsWith('data:')) {
          const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) photoBuffer = Buffer.from(match[2], 'base64');
        } else if (photo.driveFileId) {
          try {
            const driveRes = await downloadPhotoFromGoogleDrive(photo.driveFileId);
            if (driveRes.ok && driveRes.body) {
              photoBuffer = Buffer.from(await driveRes.arrayBuffer());
            }
          } catch {
            // ignore drive fetch failure for individual photo
          }
        }

        if (!photoBuffer || photoBuffer.length === 0) continue;

        const phaseName = photo.type === 'AFTER_INSTALLATION' || photo.type === 'INSTALLATION'
          ? 'Instalace'
          : photo.type === 'AFTER_DEINSTALLATION'
          ? 'Deinstalace'
          : 'Kontrola';

        const orderPrefix = String(fileIndex++).padStart(2, '0');
        const cleanLabel = sanitizeFileName(point.label || 'bod');
        const cleanName = `${orderPrefix}_${cleanLabel}_${phaseName}.jpg`;

        zipFiles.push({
          name: cleanName,
          data: photoBuffer,
        });
      }
    }

    if (zipFiles.length === 0) {
      return NextResponse.json({ error: 'Nebyly nalezeny žádné fotografie pro vybrané období.' }, { status: 404 });
    }

    const zipBuffer = buildZipArchive(zipFiles);
    const campaignSlug = sanitizeFileName(fullCampaign.name || 'zakazka');
    const periodSlug = monthFilter ? `-${monthFilter}` : '';
    const filename = `Fotodokumentace-${campaignSlug}${periodSlug}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('Chyba při vytváření ZIP archivu fotografií:', error);
    return NextResponse.json({ error: 'Chyba při stahování balíčku fotografií.' }, { status: 500 });
  }
}
