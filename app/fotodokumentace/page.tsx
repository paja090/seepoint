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

  // Transform Election Campaigns into Unified Albums
  const fieldWorkAlbums: UnifiedAlbumItem[] = electionCampaigns.map((c) => {
    const slug = buildCampaignAlbumSlug(c.id);
    const points: InternalPointWithPhotos[] = c.points.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
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

    const allPhotos = points.flatMap((p) => p.photos);
    const coverPhotoUrl = allPhotos.length > 0 ? allPhotos[0].url : null;

    return {
      id: c.id,
      source: 'FIELD_WORK',
      sourceLabel: 'Terénní práce',
      title: c.name,
      clientName: c.clientName,
      createdAt: c.createdAt,
      photosCount: allPhotos.length,
      pointsCount: points.length,
      coverPhotoUrl,
      albumSlug: slug,
      publicShareUrl: `/client/fotodokumentace/${slug}`,
      downloadZipUrl: `/api/client/fotodokumentace/${encodeURIComponent(slug)}/download-zip`,
      points,
    };
  });

  // Transform Navigation Documentation into Unified Albums
  const navigationAlbums: UnifiedAlbumItem[] = navigationReports.map((r) => {
    const points: InternalPointWithPhotos[] = r.items
      .filter((it) => it.selectedPhoto)
      .map((it) => ({
        id: it.id,
        label: it.navigationPoint?.label || it.carrier?.name || `Bod ${it.carrier?.code || it.id.slice(-4)}`,
        description: it.carrier?.code ? `Nosič: ${it.carrier.code}` : null,
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

    return {
      id: r.id,
      source: 'NAVIGATION',
      sourceLabel: 'Navigační reklama VO',
      title: r.title,
      clientName: r.client?.name || 'Klient VO',
      createdAt: r.createdAt,
      photosCount: allPhotos.length,
      pointsCount: points.length,
      coverPhotoUrl,
      albumSlug: r.id,
      publicShareUrl: `/navigation/documentation`,
      downloadZipUrl: `/api/client/navigation-documentation/${encodeURIComponent(r.id)}/download-zip`,
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
    let clientName = null;
    let pointLabel = null;

    if (p.electionRemovalPoint) {
      sourceTitle = p.electionRemovalPoint.campaign?.name || 'Terénní práce';
      clientName = p.electionRemovalPoint.campaign?.clientName || null;
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
