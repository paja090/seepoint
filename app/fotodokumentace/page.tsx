import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { buildCampaignAlbumSlug, buildSurfaceAlbumSlug } from '@/lib/election-removal/album-token';
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

  // Load Field Work campaigns, Navigation Documentation reports, and Recent Photos in parallel
  const [electionCampaigns, navigationReports, carrierSurfaces, rawRecentPhotos] = await Promise.all([
    prisma.electionCampaign.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
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
    }),
    prisma.navigationDocumentationReport.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
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
                surfaceId: true,
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
                address: true,
                city: true,
                surfaces: {
                  select: {
                    id: true,
                    name: true,
                    directionDescription: true,
                    currentClientId: true,
                    photos: {
                      where: { isPrivate: false },
                      orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                      take: 1,
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
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.advertisingSurface.findMany({
      where: {
        organizationId,
        photos: {
          some: {
            organizationId,
            isPrivate: false,
          },
        },
      },
      select: {
        id: true,
        name: true,
        directionDescription: true,
        currentClientId: true,
        currentClient: { select: { id: true, name: true } },
        carrier: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
        photos: {
          where: {
            organizationId,
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
      take: 100,
    }),
    prisma.photo.findMany({
      where: {
        organizationId,
        isPrivate: false,
        OR: [
          { electionRemovalPointId: { not: null } },
          { navigationDocumentationItems: { some: {} } },
          { workOrderItemId: { not: null } },
          { carrierId: { not: null } },
          { surfaceId: { not: null } },
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
        surfaceId: true,
        surface: {
          select: {
            id: true,
            name: true,
            currentClientId: true,
            currentClient: { select: { id: true, name: true } },
            carrier: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
  ]);

  function getLatestPhoto<T extends { createdAt: string | Date }>(photos: T[]): T | null {
    if (photos.length === 0) return null;
    let latest = photos[0];
    let latestTime = new Date(latest.createdAt).getTime();
    for (let i = 1; i < photos.length; i++) {
      const t = new Date(photos[i].createdAt).getTime();
      if (!Number.isNaN(t) && t > latestTime) {
        latestTime = t;
        latest = photos[i];
      }
    }
    return latest;
  }

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
        const latestPhoto = getLatestPhoto(clientPhotos);
        const coverPhotoUrl =
          latestPhoto
            ? `/api/photos/${encodeURIComponent(latestPhoto.id)}/thumbnail`
            : null;
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
          latestPhotoAt: latestPhoto?.createdAt ?? null,
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
    const latestPhoto = getLatestPhoto(allPhotos);
    const coverPhotoUrl =
      latestPhoto
        ? `/api/photos/${encodeURIComponent(latestPhoto.id)}/thumbnail`
        : null;
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
        latestPhotoAt: latestPhoto?.createdAt ?? null,
      },
    ];
  });

  // Transform Navigation Documentation into Unified Albums
  const navigationAlbums: UnifiedAlbumItem[] = navigationReports.map((r) => {
    const points: InternalPointWithPhotos[] = [];
    for (const it of r.items) {
      const clientSurface = it.carrier?.surfaces?.find((s) => s.currentClientId === r.clientId) ?? null;
      const snap = it.snapshot as { pointCode?: string; address?: string; direction?: string; city?: string } | null;

      // Isolate selected photo: if it.selectedPhoto is attached to another surface, prefer client surface photo
      let effectivePhoto = it.selectedPhoto;
      if (clientSurface && effectivePhoto?.surfaceId && effectivePhoto.surfaceId !== clientSurface.id) {
        if (clientSurface.photos && clientSurface.photos.length > 0) {
          effectivePhoto = { ...clientSurface.photos[0], surfaceId: clientSurface.id };
        }
      }
      if (!effectivePhoto && clientSurface?.photos && clientSurface.photos.length > 0) {
        effectivePhoto = { ...clientSurface.photos[0], surfaceId: clientSurface.id };
      }

      if (!effectivePhoto) continue;

      // Strict client-isolated label: NEVER use it.carrier?.name because on shared poles it belongs to another client
      const label =
        clientSurface?.name ||
        it.navigationPoint?.label ||
        (it.carrier?.address
          ? `${it.carrier.address}${clientSurface?.directionDescription ? ` · ${clientSurface.directionDescription}` : ''}`
          : `Bod ${it.carrier?.code || it.id.slice(-4)}`);

      const description = [
        it.carrier?.code ? `Nosič: ${it.carrier.code}` : null,
        clientSurface?.directionDescription || snap?.direction || null,
      ].filter(Boolean).join(' · ') || null;

      points.push({
        id: it.id,
        label,
        description,
        clientName: r.client?.name || 'Klient VO',
        quantity: 1,
        operationType: 'INSPECTION',
        latitude: it.navigationPoint?.latitude || effectivePhoto.capturedLatitude || 0,
        longitude: it.navigationPoint?.longitude || effectivePhoto.capturedLongitude || 0,
        photos: [
          {
            id: effectivePhoto.id,
            url: `/api/photos/${encodeURIComponent(effectivePhoto.id)}/file`,
            type: effectivePhoto.type,
            fileName: effectivePhoto.fileName,
            createdAt: effectivePhoto.createdAt,
            capturedLatitude: effectivePhoto.capturedLatitude,
            capturedLongitude: effectivePhoto.capturedLongitude,
            capturedByWorkerName: effectivePhoto.capturedByWorkerName,
          },
        ],
      });
    }

    const allPhotos = points.flatMap((p) => p.photos);
    const latestPhoto = getLatestPhoto(allPhotos);
    const coverPhotoUrl =
      latestPhoto
        ? `/api/photos/${encodeURIComponent(latestPhoto.id)}/thumbnail`
        : null;
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
      latestPhotoAt: latestPhoto?.createdAt ?? null,
    };
  });

  // Transform Carrier Surfaces into Unified Albums (grouped by client or carrier network)
  const carrierSurfaceAlbums: UnifiedAlbumItem[] = [];
  const surfacesByClient = new Map<string, typeof carrierSurfaces>();

  for (const s of carrierSurfaces) {
    if (!s.photos || s.photos.length === 0) continue;
    const clientKey = s.currentClient?.name?.trim() || 'Vlastní síť nosičů';
    const list = surfacesByClient.get(clientKey) || [];
    list.push(s);
    surfacesByClient.set(clientKey, list);
  }

  for (const [clientKey, surfaceList] of surfacesByClient.entries()) {
    const points: InternalPointWithPhotos[] = surfaceList.map((s) => ({
      id: `surface-${s.id}`,
      label: s.carrier ? `${s.carrier.code} · ${s.name}` : s.name,
      description: [
        s.carrier?.address ? s.carrier.address : null,
        s.carrier?.city ? s.carrier.city : null,
        s.directionDescription ? `Směr: ${s.directionDescription}` : null,
      ].filter(Boolean).join(', ') || null,
      clientName: clientKey === 'Vlastní síť nosičů' ? undefined : clientKey,
      quantity: 1,
      operationType: 'INSPECTION',
      latitude: s.carrier?.latitude || s.photos[0]?.capturedLatitude || 0,
      longitude: s.carrier?.longitude || s.photos[0]?.capturedLongitude || 0,
      photos: s.photos.map((ph) => ({
        id: ph.id,
        url: `/api/photos/${encodeURIComponent(ph.id)}/file`,
        type: ph.type,
        fileName: ph.fileName,
        createdAt: ph.createdAt,
        capturedLatitude: ph.capturedLatitude,
        capturedLongitude: ph.capturedLongitude,
        capturedByWorkerName: ph.capturedByWorkerName,
      })),
    }));

    const allPhotos = points.flatMap((p) => p.photos);
    if (allPhotos.length === 0) continue;

    const latestPhoto = getLatestPhoto(allPhotos) || allPhotos[0];
    const latestPhotoDate = new Date(latestPhoto.createdAt);
    const year = Number.isNaN(latestPhotoDate.getTime()) ? new Date().getFullYear() : latestPhotoDate.getFullYear();
    const month = Number.isNaN(latestPhotoDate.getTime()) ? new Date().getMonth() + 1 : latestPhotoDate.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const periodLabel = `${quarter}. čtvrtletí ${year}`;
    const coverPhotoUrl = `/api/photos/${encodeURIComponent(latestPhoto.id)}/thumbnail`;
    const safeClientSlug = clientKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plochy';

    carrierSurfaceAlbums.push({
      id: `carrier-surfaces::${safeClientSlug}`,
      source: 'FIELD_WORK',
      sourceLabel: 'Kontrola ploch',
      title: `${clientKey} – Kontrola ploch`,
      displayTitle: clientKey,
      displaySubtitle: 'Pravidelná kontrola a fotodokumentace reklamních ploch',
      displayBadge: `Kontrola • ${periodLabel}`,
      clientName: clientKey === 'Vlastní síť nosičů' ? null : clientKey,
      createdAt: allPhotos[0].createdAt,
      year,
      month,
      quarter,
      periodLabel,
      photosCount: allPhotos.length,
      pointsCount: points.length,
      coverPhotoUrl,
      albumSlug: buildSurfaceAlbumSlug(organizationId, clientKey),
      publicShareUrl: `/client/fotodokumentace/${encodeURIComponent(buildSurfaceAlbumSlug(organizationId, clientKey))}`,
      downloadZipUrl: `/api/client/fotodokumentace/${encodeURIComponent(buildSurfaceAlbumSlug(organizationId, clientKey))}/download-zip`,
      points,
      latestPhotoAt: latestPhoto.createdAt,
    });
  }

  // Merge and sort all albums by photo capture date (newest first), falling back to creation date
  const unifiedAlbums: UnifiedAlbumItem[] = [...fieldWorkAlbums, ...navigationAlbums, ...carrierSurfaceAlbums].sort((a, b) => {
    const timeA = a.latestPhotoAt ? new Date(a.latestPhotoAt).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.latestPhotoAt ? new Date(b.latestPhotoAt).getTime() : new Date(b.createdAt).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.photosCount - a.photosCount;
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
    } else if (p.surface) {
      sourceTitle = (p.type === 'CONTROL' || p.type === 'CHECK')
        ? 'Kontrola reklamní plochy'
        : (p.carrier?.name || p.surface.carrier?.name || `Plocha ${p.surface.name}`);
      clientName = p.surface.currentClient?.name || null;
      const carrierCode = p.carrier?.code || p.surface.carrier?.code;
      pointLabel = carrierCode ? `${carrierCode} · ${p.surface.name}` : p.surface.name;
    } else if (p.carrier) {
      sourceTitle = (p.type === 'CONTROL' || p.type === 'CHECK')
        ? 'Kontrola nosiče'
        : (p.carrier.name || `Nosič ${p.carrier.code}`);
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
      carrierCode: p.carrier?.code || p.surface?.carrier?.code,
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
