import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterPublicCampaignAlbumTenant } from '@/lib/public-tenant';
import { verifyCampaignAlbumSlug } from '@/lib/election-removal/album-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const campaignId = verifyCampaignAlbumSlug(token);
    if (!campaignId) {
      return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
    }

    const campaign = await enterPublicCampaignAlbumTenant(token);
    if (!campaign) {
      return NextResponse.json({ error: 'Fotodokumentace nebyla nalezena.' }, { status: 404 });
    }

    const url = new URL(req.url);
    const monthFilter = url.searchParams.get('month'); // "2026-10"
    const typeFilter = url.searchParams.get('type'); // "INSTALLATION", "DEINSTALLATION", etc.

    const fullCampaign = await prisma.electionCampaign.findFirst({
      where: { id: campaign.id, organizationId: campaign.organizationId },
      include: {
        points: {
          include: {
            photos: {
              where: { isPrivate: false },
              select: {
                id: true,
                type: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true,
                capturedLatitude: true,
                capturedLongitude: true,
                capturedByWorkerName: true,
                fieldWorkStepId: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            steps: {
              select: {
                id: true,
                sequence: true,
                kind: true,
                label: true,
                photoType: true,
                status: true,
                completedQuantity: true,
              },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!fullCampaign) {
      return NextResponse.json({ error: 'Fotodokumentace nebyla nalezena.' }, { status: 404 });
    }

    // Extract all periods (year-month) present across all photos
    const periodsSet = new Set<string>();
    for (const point of fullCampaign.points) {
      for (const photo of point.photos) {
        const d = new Date(photo.createdAt);
        if (!Number.isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          periodsSet.add(`${y}-${m}`);
        }
      }
    }
    const availablePeriods = Array.from(periodsSet).sort().reverse();

    // Map and filter points & photos
    const points = fullCampaign.points.map((p) => {
      const filteredPhotos = p.photos.filter((photo) => {
        if (monthFilter) {
          const d = new Date(photo.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (ym !== monthFilter) return false;
        }
        if (typeFilter) {
          if (typeFilter === 'INSTALLATION' && !['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type)) {
            return false;
          }
          if (typeFilter === 'DEINSTALLATION' && photo.type !== 'AFTER_DEINSTALLATION') {
            return false;
          }
          if (typeFilter === 'CONTROL' && photo.type !== 'CONTROL') {
            return false;
          }
        }
        return true;
      });

      return {
        id: p.id,
        label: p.label,
        description: p.description,
        mediaType: p.mediaType,
        objectType: p.objectType,
        quantity: p.quantity,
        latitude: p.latitude,
        longitude: p.longitude,
        operationType: p.operationType,
        photos: filteredPhotos.map((ph) => ({
          ...ph,
          url: `/api/client/fotodokumentace/${encodeURIComponent(token)}/photos/${encodeURIComponent(ph.id)}`,
        })),
        steps: p.steps,
      };
    });

    const totalRealizedPoints = fullCampaign.points.filter((p) => p.photos.length > 0).length;
    const totalPhotos = fullCampaign.points.reduce((sum, p) => sum + p.photos.length, 0);

    return NextResponse.json({
      success: true,
      campaign: {
        id: fullCampaign.id,
        name: fullCampaign.name,
        clientName: fullCampaign.clientName,
        description: fullCampaign.description,
        targetDate: fullCampaign.targetDate,
        totalPoints: fullCampaign.totalPoints,
        completedPoints: fullCampaign.completedPoints,
      },
      stats: {
        totalRealizedPoints,
        totalPhotos,
        availablePeriods,
      },
      points,
    });
  } catch (error: unknown) {
    console.error('Chyba při načítání klientského alba:', error);
    return NextResponse.json({ error: 'Chyba při načítání fotodokumentace.' }, { status: 500 });
  }
}
