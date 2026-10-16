import { PrismaClient } from '@prisma/client';
import {
  documentationPhotoSelect,
  isSurfaceForClients,
  resolveDocumentationPhotos,
  resolveDocumentationDirection,
  buildSnapshotItem,
} from '../lib/navigation-documentation.js';

const prisma = new PrismaClient();

async function healDocumentationPhotos() {
  console.log('--- Starting Navigation Documentation Photo Healing Script ---');

  const reports = await prisma.navigationDocumentationReport.findMany({
    select: {
      id: true,
      title: true,
      clientId: true,
      client: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          navigationPointId: true,
          carrierId: true,
          selectedPhotoId: true,
          clientNote: true,
          snapshot: true,
          selectedPhoto: {
            select: {
              id: true,
              url: true,
              surfaceId: true,
              carrierId: true,
              isClientVisible: true,
              isPrimary: true,
              createdAt: true,
              surface: {
                select: {
                  id: true,
                  name: true,
                  currentClientId: true,
                  currentClient: { select: { id: true, name: true } },
                  occupancies: { select: { clientId: true } },
                },
              },
            },
          },
          navigationPoint: {
            select: {
              id: true,
              label: true,
              address: true,
              latitude: true,
              longitude: true,
              status: true,
              orientation: true,
              variant: true,
              surfaceId: true,
              updatedAt: true,
              installedPhoto: { select: documentationPhotoSelect },
              sitePhoto: { select: documentationPhotoSelect },
              surface: {
                select: {
                  id: true,
                  name: true,
                  currentClientId: true,
                  directionDescription: true,
                  destinationName: true,
                  orientation: true,
                  occupancies: { select: { clientId: true } },
                  photos: {
                    where: { isPrivate: false },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                    select: documentationPhotoSelect,
                  },
                },
              },
            },
          },
          carrier: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              city: true,
              locality: true,
              latitude: true,
              longitude: true,
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                select: documentationPhotoSelect,
              },
              surfaces: {
                select: {
                  id: true,
                  name: true,
                  currentClientId: true,
                  directionDescription: true,
                  destinationName: true,
                  orientation: true,
                  occupancies: { select: { clientId: true } },
                  photos: {
                    where: { isPrivate: false },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                    select: documentationPhotoSelect,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let healedCount = 0;

  for (const report of reports) {
    const clientIds = [report.clientId];

    for (const item of report.items) {
      const carrier = item.carrier || item.navigationPoint?.carrier;
      const currentPhotoSurface = item.selectedPhoto?.surface;
      const isMismatch = currentPhotoSurface && !isSurfaceForClients(currentPhotoSurface, clientIds);

      // Check if point has a surfaceId and photo has a different surfaceId
      const isCrossSurfaceMismatch =
        item.navigationPoint?.surfaceId &&
        item.selectedPhoto?.surfaceId &&
        item.selectedPhoto.surfaceId !== item.navigationPoint.surfaceId;

      if (isMismatch || isCrossSurfaceMismatch) {
        console.log(`\nDetected mismatch in item ${item.id} (Report: "${report.title}", Client: "${report.client?.name}"):`);
        console.log(`  Current photo ${item.selectedPhotoId} is on surface "${currentPhotoSurface?.name}" (Client: "${currentPhotoSurface?.currentClient?.name || 'unknown'}")`);

        const { selectedPhoto } = resolveDocumentationPhotos({
          point: item.navigationPoint,
          carrier,
          allClientIds: clientIds,
        });

        const customDirection = resolveDocumentationDirection({
          point: item.navigationPoint,
          carrier,
          allClientIds: clientIds,
        });

        const newSnapshot = buildSnapshotItem({
          id: item.id,
          clientNote: item.clientNote,
          customDirection,
          surface: item.navigationPoint?.surface ?? null,
          navigationPoint: item.navigationPoint,
          carrier,
          selectedPhoto,
        });

        await prisma.navigationDocumentationItem.update({
          where: { id: item.id },
          data: {
            selectedPhotoId: selectedPhoto?.id ?? null,
            snapshot: newSnapshot,
          },
        });

        console.log(`  -> HEALED! Replaced with photo ${selectedPhoto?.id ?? 'none'}`);
        healedCount++;
      }
    }
  }

  console.log(`\nFinished healing. Total items healed: ${healedCount}`);
}

healDocumentationPhotos()
  .catch((err) => {
    console.error('Healing failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
