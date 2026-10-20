import { readAlbumTitle, campaignAlbumKey, surfaceAlbumKey } from '@/lib/fotodokumentace/album-title';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterPublicCampaignAlbumTenant, enterPublicSurfaceAlbumTenant } from '@/lib/public-tenant';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const url = new URL(req.url);
    const monthFilter = url.searchParams.get('month'); // "2026-10"
    const typeFilter = url.searchParams.get('type'); // "INSTALLATION", "DEINSTALLATION", etc.

    if (token.startsWith('surface.')) {
      const surfaceMeta = await enterPublicSurfaceAlbumTenant(token);
      if (!surfaceMeta) {
        return NextResponse.json({ error: 'Fotodokumentace nebyla nalezena.' }, { status: 404 });
      }

      const surfaces = await runWithTenantContext(
        { organizationId: surfaceMeta.organizationId, source: 'public-token' },
        () =>
          prisma.advertisingSurface.findMany({
            where: {
              organizationId: surfaceMeta.organizationId,
              ...(surfaceMeta.clientName === 'Vlastní síť nosičů'
                ? { currentClientId: null }
                : { currentClient: { name: { equals: surfaceMeta.clientName, mode: 'insensitive' } } }),
              photos: {
                some: {
                  organizationId: surfaceMeta.organizationId,
                  isPrivate: false,
                },
              },
            },
            include: {
              carrier: true,
              photos: {
                where: {
                  organizationId: surfaceMeta.organizationId,
                  isPrivate: false,
                },
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
            },
            orderBy: { createdAt: 'desc' },
          })
      );

      const periodsSet = new Set<string>();
      for (const surface of surfaces) {
        for (const photo of surface.photos) {
          const d = new Date(photo.createdAt);
          if (!Number.isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            periodsSet.add(`${y}-${m}`);
          }
        }
      }
      const availablePeriods = Array.from(periodsSet).sort().reverse();

      const points = surfaces.map((s) => {
        const filteredPhotos = s.photos.filter((photo) => {
          if (monthFilter) {
            const d = new Date(photo.createdAt);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym !== monthFilter) return false;
          }
          if (typeFilter && photo.type !== typeFilter) return false;
          return true;
        });

        const carrierLat = s.carrier?.latitude != null && !Number.isNaN(Number(s.carrier.latitude)) && Number(s.carrier.latitude) !== 0 ? Number(s.carrier.latitude) : null;
        const carrierLng = s.carrier?.longitude != null && !Number.isNaN(Number(s.carrier.longitude)) && Number(s.carrier.longitude) !== 0 ? Number(s.carrier.longitude) : null;
        const photoWithGps = s.photos.find(
          (ph) => ph.capturedLatitude != null && ph.capturedLongitude != null && (ph.capturedLatitude !== 0 || ph.capturedLongitude !== 0)
        );
        const latitude = carrierLat ?? (photoWithGps?.capturedLatitude ? Number(photoWithGps.capturedLatitude) : 0);
        const longitude = carrierLng ?? (photoWithGps?.capturedLongitude ? Number(photoWithGps.capturedLongitude) : 0);

        return {
          id: s.id,
          label: s.carrier ? `${s.carrier.code} · ${s.name}` : s.name,
          description: [
            s.carrier?.address ? s.carrier.address : null,
            s.carrier?.city ? s.carrier.city : null,
            s.directionDescription ? `Směr: ${s.directionDescription}` : null,
          ].filter(Boolean).join(', ') || null,
          mediaType: 'CARRIER_SURFACE',
          objectType: 'REKLAMNÍ PLOCHA',
          quantity: 1,
          latitude,
          longitude,
          operationType: 'INSPECTION',
          photos: filteredPhotos.map((ph) => ({
            ...ph,
            url: `/api/client/fotodokumentace/${encodeURIComponent(token)}/photos/${encodeURIComponent(ph.id)}`,
          })),
          steps: [],
        };
      });

      const totalPhotos = surfaces.reduce((sum, s) => sum + s.photos.length, 0);
      return NextResponse.json({
        success: true,
        campaign: {
          id: `surface-${surfaceMeta.organizationId}`,
          name: await readAlbumTitle(surfaceMeta.organizationId,surfaceAlbumKey(surfaceMeta.clientName),surfaceMeta.clientName+' – Kontrola reklamních ploch'),
          clientName: surfaceMeta.clientName,
          description: 'Pravidelná kontrola a fotodokumentace reklamních ploch',
          targetDate: null,
          totalPoints: surfaces.length,
          completedPoints: surfaces.length,
        },
        stats: {
          totalRealizedPoints: surfaces.length,
          totalPhotos,
          availablePeriods,
        },
        points,
      });
    }

    const campaign = await enterPublicCampaignAlbumTenant(token);
    if (!campaign) {
      return NextResponse.json({ error: 'Fotodokumentace nebyla nalezena.' }, { status: 404 });
    }

    const fullCampaign = await runWithTenantContext(
      { organizationId: campaign.organizationId, source: 'public-token' },
      () =>
        prisma.electionCampaign.findFirst({
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
        })
    );

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
        name: await readAlbumTitle(campaign.organizationId,campaignAlbumKey(campaign.id,url.searchParams.get('client')),await readAlbumTitle(campaign.organizationId,campaignAlbumKey(campaign.id),fullCampaign.name)),
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
