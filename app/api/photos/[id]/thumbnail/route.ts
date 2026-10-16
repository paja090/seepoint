import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { canReadPhoto } from '@/lib/photo-access';
import sharp from 'sharp';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (!user.organizationId) return NextResponse.json({ error: 'Vyberte organizaci.' }, { status: 403 });
  enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });

  const { id } = await params;

  try {
    const photo = await prisma.photo.findUnique({
      where: { id, organizationId: user.organizationId },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        storageKey: true,
        storageProvider: true,
        content: true,
        fileName: true,
        mimeType: true,
        employeeId: true,
        type: true,
        workEntryId: true,
        workOrderItemId: true,
        isPrivate: true,
        carrierId: true,
        surfaceId: true,
        siteNavigationPoints: { take: 1, select: { id: true } },
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url)) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    if (!await canReadPhoto(user, photo)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const stored = await readStoredPhoto(photo);
    if (!stored) {
      return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    }

    // Extract raw bytes buffer
    let inputBuffer: Buffer | null = null;
    if (stored.body) {
      if (Buffer.isBuffer(stored.body)) {
        inputBuffer = stored.body;
      } else if (stored.body instanceof ArrayBuffer) {
        inputBuffer = Buffer.from(stored.body);
      } else if (stored.body instanceof Uint8Array) {
        inputBuffer = Buffer.from(stored.body);
      } else {
        const arrayBuf = await new Response(stored.body as BodyInit).arrayBuffer();
        inputBuffer = Buffer.from(arrayBuf);
      }
    } else if (stored.redirectUrl) {
      try {
        const res = await fetch(stored.redirectUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          inputBuffer = Buffer.from(arrayBuf);
        }
      } catch {
        // Fallback to redirect below
      }
    }

    if (!inputBuffer) {
      return NextResponse.redirect(new URL(`/api/photos/${encodeURIComponent(id)}/file`, request.url), 307);
    }

    try {
      const resized = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: 400,
          height: 400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      return new Response(new Uint8Array(resized), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ? photo.fileName.replace(/\.[^/.]+$/, '.webp') : 'thumbnail.webp')}`,
          'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (sharpError) {
      console.warn('[thumbnail] Sharp resize failed, falling back to original file', sharpError);
      return NextResponse.redirect(new URL(`/api/photos/${encodeURIComponent(id)}/file`, request.url), 307);
    }
  } catch (error) {
    console.error('Photo thumbnail failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.redirect(new URL(`/api/photos/${encodeURIComponent(id)}/file`, request.url), 307);
  }
}
