import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterPublicCampaignAlbumTenant, enterPublicSurfaceAlbumTenant } from '@/lib/public-tenant';
import { verifyCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { generateWebpThumbnail, getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  try {
    const { token, photoId } = await params;
    let organizationId: string;
    let allowed = false;

    if (token.startsWith('surface.')) {
      const surfaceMeta = await enterPublicSurfaceAlbumTenant(token);
      if (!surfaceMeta) {
        return NextResponse.json({ error: 'Album nebylo nalezeno.' }, { status: 404 });
      }
      organizationId = surfaceMeta.organizationId;

      const photoMeta = await prisma.photo.findFirst({
        where: {
          id: photoId,
          organizationId: surfaceMeta.organizationId,
          isPrivate: false,
        },
        select: {
          id: true,
          surface: {
            select: {
              currentClient: { select: { name: true } },
            },
          },
        },
      });

      const photoClientName = photoMeta?.surface?.currentClient?.name || 'Vlastní síť nosičů';
      if (photoMeta && photoClientName.trim().toLowerCase() === surfaceMeta.clientName.trim().toLowerCase()) {
        allowed = true;
      }
    } else {
      const campaignId = verifyCampaignAlbumSlug(token);
      if (!campaignId) {
        return NextResponse.json({ error: 'Neplatný token.' }, { status: 400 });
      }

      const campaign = await enterPublicCampaignAlbumTenant(token);
      if (!campaign) {
        return NextResponse.json({ error: 'Album nebylo nalezeno.' }, { status: 404 });
      }
      organizationId = campaign.organizationId;

      const photoMeta = await prisma.photo.findFirst({
        where: {
          id: photoId,
          organizationId: campaign.organizationId,
          isPrivate: false,
        },
        select: {
          id: true,
          electionRemovalPoint: {
            select: { campaignId: true },
          },
        },
      });

      if (photoMeta && photoMeta.electionRemovalPoint?.campaignId === campaign.id) {
        allowed = true;
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const urlObj = new URL(request.url);
    const isThumbnail = urlObj.searchParams.get('thumbnail') === '1';
    const cacheKey = `photo:${photoId}`;

    if (isThumbnail) {
      const cachedThumb = getCachedThumbnail(cacheKey);
      if (cachedThumb) {
        return new Response(new Uint8Array(cachedThumb), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        organizationId,
        isPrivate: false,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const file = await readStoredPhoto(photo);
    if (!file) {
      return NextResponse.json({ error: 'Soubor fotografie není dostupný.' }, { status: 404 });
    }

    if (isThumbnail) {
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
        } catch (fetchErr) {
          console.warn('[client fotodokumentace photo] Remote fetch for thumbnail failed', fetchErr);
        }
      }

      if (inputBuffer) {
        try {
          const resized = await generateWebpThumbnail(cacheKey, inputBuffer);

          return new Response(new Uint8Array(resized), {
            status: 200,
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } catch (sharpError) {
          console.warn('[client fotodokumentace photo] Sharp resize failed, falling back to original', sharpError);
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
    console.error('Chyba při servírování klientské fotografie:', error);
    return NextResponse.json({ error: 'Chyba při čtení fotografie.' }, { status: 500 });
  }
}
