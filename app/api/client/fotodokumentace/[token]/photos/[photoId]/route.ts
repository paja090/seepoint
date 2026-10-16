import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterPublicCampaignAlbumTenant } from '@/lib/public-tenant';
import { verifyCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { readStoredPhoto } from '@/lib/storage/photo-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  try {
    const { token, photoId } = await params;
    const campaignId = verifyCampaignAlbumSlug(token);
    if (!campaignId) {
      return NextResponse.json({ error: 'Neplatný token.' }, { status: 400 });
    }

    const campaign = await enterPublicCampaignAlbumTenant(token);
    if (!campaign) {
      return NextResponse.json({ error: 'Album nebylo nalezeno.' }, { status: 404 });
    }

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        organizationId: campaign.organizationId,
        isPrivate: false,
      },
      include: {
        electionRemovalPoint: {
          select: { campaignId: true },
        },
      },
    });

    if (!photo || photo.electionRemovalPoint?.campaignId !== campaign.id) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    const file = await readStoredPhoto(photo);
    if (!file) {
      return NextResponse.json({ error: 'Soubor fotografie není dostupný.' }, { status: 404 });
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
