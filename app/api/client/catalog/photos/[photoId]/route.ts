import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { generateWebpThumbnail, generateWebpPreview, getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params;
    const urlObj = new URL(request.url);
    const orgId = urlObj.searchParams.get('org')?.trim();

    if (!orgId || !photoId) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const org = await prisma.organization.findFirst({
      where: { id: orgId, isActive: true },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const organizationId = org.id;
    enterTenantContext({ organizationId, source: 'public-token' });

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        organizationId,
        isPrivate: false,
        type: { not: 'EXPENSE_RECEIPT' },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const isThumbnail = urlObj.searchParams.get('thumbnail') === '1';
    const isRaw = urlObj.searchParams.get('raw') === '1';
    const cacheKey = isThumbnail
      ? `catalog-photo-thumb:${photoId}`
      : `catalog-photo-preview:${photoId}`;

    // 1. Fast in-memory cache lookup for both thumbnails and optimized previews
    if (!isRaw) {
      const cached = getCachedThumbnail(cacheKey);
      if (cached) {
        return new Response(new Uint8Array(cached), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    const file = await readStoredPhoto(photo);
    if (!file) {
      return NextResponse.json({ error: 'Soubor fotografie není dostupný.' }, { status: 404 });
    }

    // 2. Global web optimization: resize large originals into crisp WebP (thumbnail 360px or preview 1600px)
    if (!isRaw) {
      let inputBuffer: Buffer | null = null;
      if (file.body) {
        if (Buffer.isBuffer(file.body)) {
          inputBuffer = file.body;
        } else if (file.body instanceof ArrayBuffer) {
          inputBuffer = Buffer.from(file.body);
        } else if (file.body instanceof Uint8Array) {
          inputBuffer = Buffer.from(file.body);
        } else {
          const ab = await new Response(file.body as BodyInit).arrayBuffer();
          inputBuffer = Buffer.from(ab);
        }
      } else if (file.redirectUrl) {
        try {
          const remoteRes = await fetch(file.redirectUrl, { cache: 'no-store' });
          if (remoteRes.ok) {
            inputBuffer = Buffer.from(await remoteRes.arrayBuffer());
          }
        } catch {
          // Ignore remote thumbnail fetch error
        }
      }

      if (inputBuffer) {
        try {
          const processed = isThumbnail
            ? await generateWebpThumbnail(cacheKey, inputBuffer)
            : await generateWebpPreview(cacheKey, inputBuffer);

          return new Response(new Uint8Array(processed), {
            status: 200,
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } catch {
          // Fallback to original file
        }
      }
    }

    if (file.redirectUrl) {
      return NextResponse.redirect(file.redirectUrl, 307);
    }

    const contentType = file.contentType || photo.mimeType || 'image/jpeg';
    return new Response(file.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[api/client/catalog/photos] GET failed:', error);
    return NextResponse.json({ error: 'Chyba při čtení fotografie.' }, { status: 500 });
  }
}
