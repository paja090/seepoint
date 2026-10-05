import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { hashToken } from '@/lib/navigation-documentation';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';
import { enterPublicNavigationReportTenant } from '@/lib/public-tenant';

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

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const owner = await enterPublicNavigationReportTenant(tokenHash);
    if (!owner) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const report = await platformPrisma.navigationDocumentationReport.findFirst({
      where: { id: owner.id, organizationId: owner.organizationId },
      include: {
        client: { select: { name: true } },
        items: {
          where: { isVisible: true },
          include: {
            navigationPoint: {
              include: {
                installedPhoto: true,
                sitePhoto: true,
              },
            },
            selectedPhoto: true,
            carrier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!report || report.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const zipFiles: Array<{ name: string; data: Buffer }> = [];

    for (let i = 0; i < report.items.length; i++) {
      const item = report.items[i];
      const photo = item.selectedPhoto || item.navigationPoint?.installedPhoto || item.navigationPoint?.sitePhoto;
      if (!photo || photo.isPrivate) continue;

      let photoBuffer: Buffer | null = null;

      // 1. Database binary
      if (photo.content && photo.content.length > 0) {
        photoBuffer = Buffer.from(photo.content);
      } else if (photo.url && photo.url.startsWith('data:')) {
        // 2. Base64 URI
        const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) photoBuffer = Buffer.from(match[2], 'base64');
      } else if (photo.driveFileId) {
        // 3. Google Drive
        try {
          const driveRes = await downloadPhotoFromGoogleDrive(photo.driveFileId);
          if (driveRes.ok && driveRes.body) {
            photoBuffer = Buffer.from(await driveRes.arrayBuffer());
          }
        } catch (e) {
          console.warn('[download-zip] Drive photo download failed', photo.id, e);
        }
      }

      if (!photoBuffer || photoBuffer.length === 0) continue;

      const orderPrefix = String(i + 1).padStart(2, '0');
      const pointCode = item.navigationPoint?.pillarNumber
        ? `VO-${item.navigationPoint.pillarNumber}`
        : item.carrier?.code || `BOD-${i + 1}`;
      const city = item.carrier?.city || 'Ostrava';
      const cleanName = `${orderPrefix}_${sanitizeFileName(pointCode)}_${sanitizeFileName(city)}.jpg`;

      zipFiles.push({
        name: cleanName,
        data: photoBuffer,
      });
    }

    if (zipFiles.length === 0) {
      return NextResponse.json({ error: 'Report neobsahuje žádné dostupné fotografie ke stažení.' }, { status: 404 });
    }

    const zipBuffer = buildZipArchive(zipFiles);
    const clientSlug = sanitizeFileName(report.client?.name || 'klient');
    const filename = `Fotodokumentace-navigaci-${clientSlug}-${report.year}.zip`;

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('[download-zip] Chyba při balení zipu', error);
    return NextResponse.json({ error: 'Chyba při stahování balíčku fotografií.' }, { status: 500 });
  }
}
