import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { buildCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import {
  UnifiedPhotoDocumentationView,
  type UnifiedAlbumItem,
  type RecentPhotoItem,
} from '@/components/fotodokumentace/UnifiedPhotoDocumentationView';
import type { InternalPointWithPhotos } from '@/components/election-removal/CampaignPhotoAlbum';
import { formatAlbumDisplay } from '@/lib/fotodokumentace/format';
import { resolvePointClientName } from '@/lib/election-removal/point-metadata';
import { getDeterministicReportToken } from '@/lib/navigation-documentation';

export const dynamic = 'force-dynamic';

export default async function PhotoDocumentationHubPage({
  searchParams,
}: {
  searchParams: Promise<{ albumId?: string; source?: string }>;
}) {
  const user = await requirePageAccess('photoDocumentation');
  const { albumId, source } = await searchParams;

  const organizationId = user.organizationId;
  if (!organizationId) notFound();

  // 1. Fetch Field Work (Terénní práce) campaigns with photos
  const electionCampaigns = await prisma.electionCampaign.findMany({
    where: { organizationId },
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
              fieldWorkStepId: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { label: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch Navigation Documentation (Navigační reklama VO) reports with items
  const navigationReports = await prisma.navigationDocumentationReport.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        where: { isVisible: true },
        include: {
          selectedPhoto: {
            select: {
              id: true,
              type: true,
              fileName: true,
              createdAt: true,
              capturedLatitude: true,
              capturedLongitude: true,
              capturedByWorkerName: true,
            },
          },
          navigationPoint: {
            select: {
              id: true,
              label: true,
              latitude: true,
              longitude: true,
            },
          },
          carrier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 3. Fetch Recent Photos stream for live feed and map
  const rawRecentPhotos = await prisma.photo.findMany({
    where: {
      organizationId,
      isPrivate: false,
      OR: [
        { electionRemovalPointId: { not: null } },
        { navigationDocumentationItems: { some: {} } },
        { workOrderItemId: { not: null } },
        { carrierId: { not: null } },
      ],
    },
    select: {
      id: true,
      type: true,
      fileName: true,
      createdAt: true,
      capturedLatitude: true,
      capturedLongitude: true,
      capturedByWorkerName: true,
      electionRemovalPoint: {
        select: {
          id: true,
          label: true,
          layerName: true,
          description: true,
          campaign: { select: { id: true, name: true, clientName: true } },
        },
      },
      carrier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  // Transform Election Campaigns into Unified Albums (grouped by client when a campaign spans multiple clients)
  const fieldWorkAlbums: UnifiedAlbumItem[] = electionCampaigns.flatMap((c) => {
    const slug = buildCampaignAlbumSlug(c.id);
    const d = new Date(c.createdAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const periodLabel = `${quarter}. čtvrtletí ${year}`;

    const mappedPoints: InternalPointWithPhotos[] = c.points.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      layerName: p.layerName,
      clientName: resolvePointClientName(p, c.clientName),
      quantity: p.quantity,
      operationType: p.operationType,
      latitude: p.latitude,
      longitude: p.longitude,
      photos: p.photos.map((ph) => ({
        id: ph.id,
        url: `/api/photos/${encodeURIComponent(ph.id)}/file`,
        type: ph.type,
        fileName: ph.fileName,
        createdAt: ph.createdAt,
        capturedLatitude: ph.capturedLatitude,
        capturedLongitude: ph.capturedLongitude,
        capturedByWorkerName: ph.capturedByWorkerName,
        fieldWorkStepId: ph.fieldWorkStepId,
      })),
    }));

    // Group points by resolved client name
    const pointsByClient = new Map<string, InternalPointWithPhotos[]>();
    for (const pt of mappedPoints) {
      const clientKey = (pt.clientName || c.clientName || '').trim();
      if (!clientKey) continue;
      const list = pointsByClient.get(clientKey) || [];
      list.push(pt);
      pointsByClient.set(clientKey, list);
    }

    // If campaign has multiple distinct clients, create per-client albums so Fotodokumentace organizes them by client
    if (pointsByClient.size > 1) {
      const clientAlbums: UnifiedAlbumItem[] = [];
      for (const [clientKey, clientPoints] of pointsByClient.entries()) {
        const clientPhotos = clientPoints.flatMap((p) => p.photos);
        const coverPhotoUrl = clientPhotos.length > 0 ? clientPhotos[0].url : null;
        const formatted = formatAlbumDisplay(`${clientKey} — ${c.name}`, clientKey, periodLabel);
        const encodedClient = encodeURIComponent(clientKey);
        const hasInspection = clientPoints.some((p) => p.operationType === 'INSPECTION');

        clientAlbums.push({
          id: `${c.id}::client::${clientKey}`,
          source: 'FIELD_WORK',
          sourceLabel: hasInspection ? 'Kontrola ploch' : 'Terénní práce',
          title: `${clientKey} (${c.name})`,
          displayTitle: clientKey,
          displaySubtitle: c.name,
          displayBadge: hasInspection ? `Kontrola • ${periodLabel}` : formatted.displayPeriod || periodLabel,
          clientName: clientKey,
          createdAt: c.createdAt,
          year,
          month,
          quarter,
          periodLabel,
          photosCount: clientPhotos.length,
          pointsCount: clientPoints.length,
          coverPhotoUrl,
          albumSlug: slug,
          publicShareUrl: `/client/fotodokumentace/${slug}?client=${encodedClient}`,
          downloadZipUrl: `/api/client/fotodokumentace/${encodeURIComponent(slug)}/download-zip?client=${encodedClient}`,
          points: clientPoints,
        });
      }
      return clientAlbums;
    }

    // Single client (or unassigned) campaign album
    const singleClient =
      pointsByClient.size === 1
        ? Array.from(pointsByClient.keys())[0]
        : c.clientName;
    const allPhotos = mappedPoints.flatMap((p) => p.photos);
    const coverPhotoUrl = allPhotos.length > 0 ? allPhotos[0].url : null;
    const formatted = formatAlbumDisplay(c.name, singleClient, periodLabel);
    const hasInspection = mappedPoints.some((p) => p.operationType === 'INSPECTION');

    return [
      {
        id: c.id,
        source: 'FIELD_WORK',
        sourceLabel: hasInspection ? 'Kontrola ploch' : 'Terénní práce',
        title: c.name,
        displayTitle: formatted.displayTitle,
        displaySubtitle: formatted.displayLocation || null,
        displayBadge: hasInspection ? `Kontrola • ${periodLabel}` : formatted.displayPeriod || periodLabel,
        clientName: singleClient,
        createdAt: c.createdAt,
        year,
        month,
        quarter,
        periodLabel,
        photosCount: allPhotos.length,
        pointsCount: mappedPoints.length,
        coverPhotoUrl,
        albumSlug: slug,
        publicShareUrl: `/client/fotodokumentace/${slug}`,
        downloadZipUrl: `/api/client/fotodokumentace/${encodeURIComponent(slug)}/download-zip`,
        points: mappedPoints,
      },
    ];
  });

  // Transform Navigation Documentation into Unified Albums
  const navigationAlbums: UnifiedAlbumItem[] = navigationReports.map((r) => {
    const points: InternalPointWithPhotos[] = r.items
      .filter((it) => it.selectedPhoto)
      .map((it) => ({
        id: it.id,
        label: it.navigationPoint?.label || it.carrier?.name || `Bod ${it.carrier?.code || it.id.slice(-4)}`,
        description: it.carrier?.code ? `Nosič: ${it.carrier.code}` : null,
        clientName: r.client?.name || 'Klient VO',
        quantity: 1,
        operationType: 'INSPECTION',
        latitude: it.navigationPoint?.latitude || 0,
        longitude: it.navigationPoint?.longitude || 0,
        photos: it.selectedPhoto
          ? [
              {
                id: it.selectedPhoto.id,
                url: `/api/photos/${encodeURIComponent(it.selectedPhoto.id)}/file`,
                type: it.selectedPhoto.type,
                fileName: it.selectedPhoto.fileName,
                createdAt: it.selectedPhoto.createdAt,
                capturedLatitude: it.selectedPhoto.capturedLatitude,
                capturedLongitude: it.selectedPhoto.capturedLongitude,
                capturedByWorkerName: it.selectedPhoto.capturedByWorkerName,
              },
            ]
          : [],
      }));

    const allPhotos = points.flatMap((p) => p.photos);
    const coverPhotoUrl = allPhotos.length > 0 ? allPhotos[0].url : null;
    const year = r.year;
    const quarter = r.quarter || Math.ceil((new Date(r.periodFrom || r.createdAt).getMonth() + 1) / 3);
    const month = r.periodFrom
      ? new Date(r.periodFrom).getMonth() + 1
      : (quarter - 1) * 3 + 1;
    const periodLabel = `${quarter}. čtvrtletí ${year}`;
    const formatted = formatAlbumDisplay(r.title, r.client?.name, periodLabel);

    const { token } = getDeterministicReportToken(r.id);

    return {
      id: r.id,
      source: 'NAVIGATION',
      sourceLabel: 'Navigační reklama VO',
      title: r.title,
      displayTitle: formatted.displayTitle,
      displaySubtitle: formatted.displayLocation || null,
      displayBadge: formatted.displayPeriod || periodLabel,
      clientName: r.client?.name || 'Klient VO',
      createdAt: r.createdAt,
      year,
      month,
      quarter,
      periodLabel,
      photosCount: allPhotos.length,
      pointsCount: points.length,
      coverPhotoUrl,
      albumSlug: token,
      publicShareUrl: `/client/navigation-documentation/${token}`,
      downloadZipUrl: `/api/client/navigation-documentation/${encodeURIComponent(token)}/download-zip`,
      points,
    };
  });

  // Merge and sort all albums by photo count and creation date
  const unifiedAlbums: UnifiedAlbumItem[] = [...fieldWorkAlbums, ...navigationAlbums].sort((a, b) => {
    if (b.photosCount !== a.photosCount) {
      return b.photosCount - a.photosCount;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Transform Recent Photos for Live Feed and Map
  const recentPhotos: RecentPhotoItem[] = rawRecentPhotos.map((p) => {
    let sourceTitle = 'Záznam v terénu';
    let clientName: string | null = null;
    let pointLabel: string | null = null;

    if (p.electionRemovalPoint) {
      sourceTitle = p.electionRemovalPoint.campaign?.name || 'Terénní práce';
      clientName =
        resolvePointClientName(p.electionRemovalPoint, p.electionRemovalPoint.campaign?.clientName) ||
        p.electionRemovalPoint.campaign?.clientName ||
        null;
      pointLabel = p.electionRemovalPoint.label;
    } else if (p.carrier) {
      sourceTitle = p.carrier.name || `Nosič ${p.carrier.code}`;
      pointLabel = p.carrier.code;
    }

    return {
      id: p.id,
      url: `/api/photos/${encodeURIComponent(p.id)}/file`,
      fileName: p.fileName,
      type: p.type,
      createdAt: p.createdAt,
      workerName: p.capturedByWorkerName,
      latitude: p.capturedLatitude,
      longitude: p.capturedLongitude,
      sourceTitle,
      clientName,
      pointLabel,
      carrierCode: p.carrier?.code,
    };
  });

  return (
    <AppShell>
      <UnifiedPhotoDocumentationView
        albums={unifiedAlbums}
        recentPhotos={recentPhotos}
        initialAlbumId={albumId}
        initialSource={source}
      />
    </AppShell>
  );
}
