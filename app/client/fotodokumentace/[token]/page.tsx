import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolvePointClientName } from '@/lib/election-removal/point-metadata';
import { enterPublicCampaignAlbumTenant, enterPublicSurfaceAlbumTenant } from '@/lib/public-tenant';
import { runWithTenantContext } from '@/lib/tenant-context';
import {
  PublicCampaignAlbumView,
  type PublicPointItem,
} from '@/components/election-removal/PublicCampaignAlbumView';

export const dynamic = 'force-dynamic';

export default async function PublicFotodokumentacePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string; client?: string }>;
}) {
  const { token } = await params;
  const { month, client } = await searchParams;

  if (token.startsWith('surface.')) {
    const surfaceMeta = await enterPublicSurfaceAlbumTenant(token);
    if (!surfaceMeta) notFound();

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
                createdAt: true,
                capturedLatitude: true,
                capturedLongitude: true,
                capturedByWorkerName: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
    );

    const clientDisplayName = surfaceMeta.clientName;

    if (surfaces.length === 0) {
      return (
        <PublicCampaignAlbumView
          token={token}
          campaign={{
            id: `surface-${surfaceMeta.organizationId}`,
            name: `${clientDisplayName} – Kontrola reklamních ploch`,
            clientName: clientDisplayName,
            description: 'Pravidelná kontrola a fotodokumentace reklamních ploch',
            targetDate: null,
            totalPoints: 0,
            completedPoints: 0,
          }}
          points={[]}
          availablePeriods={[]}
          initialPeriod={month}
        />
      );
    }

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

    const points: PublicPointItem[] = surfaces.map((s) => {
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
        photos: s.photos.map((ph) => ({
          id: ph.id,
          type: ph.type,
          fileName: ph.fileName,
          createdAt: ph.createdAt.toISOString(),
          capturedLatitude: ph.capturedLatitude != null ? Number(ph.capturedLatitude) : null,
          capturedLongitude: ph.capturedLongitude != null ? Number(ph.capturedLongitude) : null,
          capturedByWorkerName: ph.capturedByWorkerName,
          url: `/api/client/fotodokumentace/${encodeURIComponent(token)}/photos/${encodeURIComponent(ph.id)}`,
        })),
      };
    });

    return (
      <PublicCampaignAlbumView
        token={token}
        campaign={{
          id: `surface-${surfaceMeta.organizationId}`,
          name: `${clientDisplayName} – Kontrola reklamních ploch`,
          clientName: clientDisplayName,
          description: 'Pravidelná kontrola a fotodokumentace reklamních ploch',
          targetDate: null,
          totalPoints: points.length,
          completedPoints: points.length,
        }}
        points={points}
        availablePeriods={availablePeriods}
        initialPeriod={month}
      />
    );
  }

  const campaignMeta = await enterPublicCampaignAlbumTenant(token);
  if (!campaignMeta) notFound();

  const campaign = await runWithTenantContext(
    { organizationId: campaignMeta.organizationId, source: 'public-token' },
    () =>
      prisma.electionCampaign.findFirst({
        where: { id: campaignMeta.id, organizationId: campaignMeta.organizationId },
        include: {
          points: {
            include: {
              photos: {
                where: { isPrivate: false },
                select: {
                  id: true,
                  type: true,
                  fileName: true,
                  createdAt: true,
                  capturedLatitude: true,
                  capturedLongitude: true,
                  capturedByWorkerName: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { label: 'asc' },
          },
        },
      })
  );

  if (!campaign) notFound();

  const clientFilter = client?.trim() || null;
  const filteredRawPoints = clientFilter
    ? campaign.points.filter((p) => {
        const resolved = resolvePointClientName(p, campaign.clientName) || campaign.clientName || '';
        return resolved.trim().toLowerCase() === clientFilter.toLowerCase();
      })
    : campaign.points;

  // Extract all available periods (year-month) across matching photos
  const periodsSet = new Set<string>();
  for (const point of filteredRawPoints) {
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

  const points: PublicPointItem[] = filteredRawPoints.map((p) => {
    const photoWithGps = p.photos.find(
      (ph) => ph.capturedLatitude != null && ph.capturedLongitude != null && (ph.capturedLatitude !== 0 || ph.capturedLongitude !== 0)
    );
    const latitude = (p.latitude != null && !Number.isNaN(Number(p.latitude)) && Number(p.latitude) !== 0)
      ? Number(p.latitude)
      : (photoWithGps?.capturedLatitude ? Number(photoWithGps.capturedLatitude) : 0);
    const longitude = (p.longitude != null && !Number.isNaN(Number(p.longitude)) && Number(p.longitude) !== 0)
      ? Number(p.longitude)
      : (photoWithGps?.capturedLongitude ? Number(photoWithGps.capturedLongitude) : 0);

    return {
      id: p.id,
      label: p.label,
      description: p.description,
      mediaType: p.mediaType,
      objectType: p.objectType,
      quantity: p.quantity,
      latitude,
      longitude,
      operationType: p.operationType,
      photos: p.photos.map((ph) => ({
        id: ph.id,
        type: ph.type,
        fileName: ph.fileName,
        createdAt: ph.createdAt.toISOString(),
        capturedLatitude: ph.capturedLatitude != null ? Number(ph.capturedLatitude) : null,
        capturedLongitude: ph.capturedLongitude != null ? Number(ph.capturedLongitude) : null,
        capturedByWorkerName: ph.capturedByWorkerName,
        url: `/api/client/fotodokumentace/${encodeURIComponent(token)}/photos/${encodeURIComponent(ph.id)}`,
      })),
    };
  });

  return (
    <PublicCampaignAlbumView
      token={token}
      campaign={{
        id: campaign.id,
        name: clientFilter ? `${clientFilter} — ${campaign.name}` : campaign.name,
        clientName: clientFilter || campaign.clientName,
        description: campaign.description,
        targetDate: campaign.targetDate ? campaign.targetDate.toISOString() : null,
        totalPoints: filteredRawPoints.length,
        completedPoints: filteredRawPoints.filter((p) => p.status === 'COMPLETED').length,
      }}
      points={points}
      availablePeriods={availablePeriods}
      initialPeriod={month}
    />
  );
}
