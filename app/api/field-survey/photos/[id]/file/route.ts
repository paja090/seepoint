import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import sharp from 'sharp';

export const runtime = 'nodejs';

/**
 * GET /api/field-survey/photos/[id]/file
 *
 * Bezpečné servírování fotografií z terénního průzkumu.
 * Fotografie jsou striktně odděleny od modelu Photo a nosičů.
 * Přístup je podmíněn RBAC sekcí 'fieldSurvey' a tenant isolation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (!user.organizationId) return NextResponse.json({ error: 'Vyberte organizaci.' }, { status: 403 });

  if (!canAccess(user.role, 'fieldSurvey')) {
    return NextResponse.json({ error: 'Nemáte oprávnění k prohlížení průzkumných fotografií.' }, { status: 403 });
  }

  enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });

  try {
    const { id } = await params;
    const photo = await prisma.fieldSurveyPhoto.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [
          { id },
          { url: { contains: id } },
        ],
      },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        storageKey: true,
        storageProvider: true,
        content: true,
        fileName: true,
        mimeType: true,
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url)) {
      return NextResponse.json({ error: 'Fotografie průzkumu nebyla nalezena.' }, { status: 404 });
    }

    const stored = await readStoredPhoto(photo);
    if (!stored) {
      return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    }

    const urlObj = new URL(request.url);
    const isThumbnail = urlObj.searchParams.get('thumbnail') === '1';

    if (isThumbnail) {
      let inputBuffer: Buffer | null = null;
      if (stored.body) {
        if (Buffer.isBuffer(stored.body)) {
          inputBuffer = stored.body;
        } else if (stored.body instanceof ArrayBuffer) {
          inputBuffer = Buffer.from(stored.body);
        } else if (stored.body instanceof Uint8Array) {
          inputBuffer = Buffer.from(stored.body);
        } else {
          const ab = await new Response(stored.body as BodyInit).arrayBuffer();
          inputBuffer = Buffer.from(ab);
        }
      } else if (stored.redirectUrl) {
        try {
          const remoteRes = await fetch(stored.redirectUrl, { cache: 'no-store' });
          if (remoteRes.ok) {
            inputBuffer = Buffer.from(await remoteRes.arrayBuffer());
          }
        } catch (fetchErr) {
          console.warn('[field-survey/photos/file] Remote fetch for thumbnail failed', fetchErr);
        }
      }

      if (inputBuffer) {
        try {
          const resized = await sharp(inputBuffer)
            .rotate()
            .resize({
              width: 600,
              height: 600,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toBuffer();

          return new Response(new Uint8Array(resized), {
            status: 200,
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } catch (sharpErr) {
          console.warn('[field-survey/photos/file] Sharp resize failed, falling back to original', sharpErr);
        }
      }
    }

    if (stored.redirectUrl) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: stored.redirectUrl,
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    return new Response(stored.body, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType ?? photo.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'field-survey-photo')}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[field-survey/photos/file] Chyba při čtení fotografie', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
