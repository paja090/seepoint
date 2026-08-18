import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { runPrePublishChecks, buildSnapshotItem } from '@/lib/navigation-documentation';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  let report = await prisma.navigationDocumentationReport.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, logoFileName: true } },
      offer: { select: { id: true, campaignName: true, title: true } },
      navigationOffer: { select: { id: true, targetName: true, targetAddress: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      auditLogs: {
        include: { actorUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      items: {
        include: {
          navigationPoint: {
            include: {
              installedPhoto: true,
              carrier: {
                include: {
                  photos: {
                    where: { isPrivate: false },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                  },
                },
              },
            },
          },
          carrier: {
            include: {
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
            },
          },
          selectedPhoto: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
  }

  const reportId = report.id;
  const clientId = report.clientId;
  const clientName = report.client.name;

  // Auto-heal empty items if report has 0 items
  if (report.items.length === 0) {
    let points = await prisma.navigationPoint.findMany({
      where: {
        navigationOrder: { crmOrder: { clientId, ...(report.offerId ? { offerId: report.offerId } : {}) } },
        status: { notIn: ['REMOVED', 'CANCELLED'] },
      },
      include: {
        carrier: {
          include: {
            photos: {
              where: { isPrivate: false },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (points.length === 0) {
      points = await prisma.navigationPoint.findMany({
        where: {
          navigationOffer: { offer: { clientId } },
          status: { notIn: ['REMOVED', 'CANCELLED'] },
        },
        include: {
          carrier: {
            include: {
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
    }

    let itemInputs: Array<{
      reportId: string;
      navigationPointId?: string;
      carrierId?: string;
      selectedPhotoId?: string;
      sortOrder: number;
      isVisible: boolean;
    }> = [];

    if (points.length > 0) {
      itemInputs = points.map((point, index) => ({
        reportId,
        navigationPointId: point.id,
        carrierId: point.carrierId ?? undefined,
        selectedPhotoId: point.installedPhotoId ?? point.carrier?.photos[0]?.id ?? undefined,
        sortOrder: index,
        isVisible: true,
      }));
    } else {
      const carriers = await prisma.advertisingCarrier.findMany({
        where: {
          archivedAt: null,
          surfaces: {
            some: {
              OR: [
                { currentClientId: clientId },
                { occupancies: { some: { clientId } } },
                { occupancies: { some: { clientName: { contains: clientName, mode: 'insensitive' } } } },
              ],
            },
          },
        },
        include: {
          photos: {
            where: { isPrivate: false },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: { code: 'asc' },
        take: 100,
      });

      itemInputs = carriers.map((carrier, index) => ({
        reportId,
        carrierId: carrier.id,
        selectedPhotoId: carrier.photos[0]?.id ?? undefined,
        sortOrder: index,
        isVisible: true,
      }));
    }

    if (itemInputs.length > 0) {
      await prisma.navigationDocumentationItem.createMany({
        data: itemInputs,
      });

      // Re-fetch updated report
      const updatedReport = await prisma.navigationDocumentationReport.findUnique({
        where: { id: reportId },
        include: {
          client: { select: { id: true, name: true, email: true, logoFileName: true } },
          offer: { select: { id: true, campaignName: true, title: true } },
          navigationOffer: { select: { id: true, targetName: true, targetAddress: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          auditLogs: {
            include: { actorUser: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          items: {
            include: {
              navigationPoint: {
                include: {
                  installedPhoto: true,
                  carrier: {
                    include: {
                      photos: {
                        where: { isPrivate: false },
                        orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                      },
                    },
                  },
                },
              },
              carrier: {
                include: {
                  photos: {
                    where: { isPrivate: false },
                    orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                  },
                },
              },
              selectedPhoto: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (updatedReport) {
        report = updatedReport;
  // Helper to get merged carrier photos from carrier direct photos + surface photos
  function getMergedCarrierPhotos(carrier: any) {
    if (!carrier) return [];
    const directPhotos = carrier.photos || [];
    const surfacePhotos = (carrier.surfaces || []).flatMap((s: any) => s.photos || []);
    const map = new Map<string, any>();
    for (const photo of [...directPhotos, ...surfacePhotos]) {
      if (!map.has(photo.id)) map.set(photo.id, photo);
    }
    return Array.from(map.values()).sort((a: any, b: any) => {
      if (a.isClientVisible !== b.isClientVisible) return a.isClientVisible ? -1 : 1;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  // Unified auto-healing for carrierId, carrier photos, and selectedPhoto
  const itemsToUpdate: Array<{ id: string; carrierId?: string; selectedPhotoId?: string }> = [];

  const processedItems = report.items.map((item) => {
    const carrier = item.carrier || item.navigationPoint?.carrier;
    const carrierId = item.carrierId || item.navigationPoint?.carrierId || null;
    const allPhotos = getMergedCarrierPhotos(carrier);

    const selectedPhoto =
      item.selectedPhoto ||
      (item.selectedPhotoId ? allPhotos.find((p: any) => p.id === item.selectedPhotoId) : null) ||
      item.navigationPoint?.installedPhoto ||
      allPhotos[0] ||
      null;

    const selectedPhotoId = selectedPhoto?.id || null;

    if ((!item.carrierId && carrierId) || (!item.selectedPhotoId && selectedPhotoId)) {
      itemsToUpdate.push({
        id: item.id,
        ...(carrierId && !item.carrierId ? { carrierId } : {}),
        ...(selectedPhotoId && !item.selectedPhotoId ? { selectedPhotoId } : {}),
      });
    }

    return {
      ...item,
      carrierId,
      carrier: carrier
        ? {
            ...carrier,
            photos: allPhotos,
          }
        : null,
      selectedPhotoId,
      selectedPhoto,
    };
  });

  if (itemsToUpdate.length > 0) {
    await prisma.$transaction(
      itemsToUpdate.map((u) =>
        prisma.navigationDocumentationItem.update({
          where: { id: u.id },
          data: {
            ...(u.carrierId ? { carrierId: u.carrierId } : {}),
            ...(u.selectedPhotoId ? { selectedPhotoId: u.selectedPhotoId } : {}),
          },
        }),
      ),
    );
  }

  report = {
    ...report,
    items: processedItems,
  };

  const warnings = runPrePublishChecks(report.client.email, report.items, report.periodFrom);

  return NextResponse.json({ ...report, warnings });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await request.json();

    const existing = await prisma.navigationDocumentationReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.quarter !== undefined) updateData.quarter = Number(body.quarter);
    if (body.year !== undefined) updateData.year = Number(body.year);
    if (body.status !== undefined) updateData.status = body.status;

    if (Array.isArray(body.items)) {
      for (const itemInput of body.items) {
        if (!itemInput.id) continue;

        const photoId =
          itemInput.selectedPhotoId && String(itemInput.selectedPhotoId).trim() !== ''
            ? String(itemInput.selectedPhotoId).trim()
            : null;

        const updatedItem = await prisma.navigationDocumentationItem.update({
          where: { id: itemInput.id },
          data: {
            selectedPhotoId: photoId,
            clientNote: itemInput.clientNote !== undefined ? (itemInput.clientNote ? String(itemInput.clientNote).trim() : null) : undefined,
            sortOrder: itemInput.sortOrder !== undefined ? Number(itemInput.sortOrder) : undefined,
            isVisible: itemInput.isVisible !== undefined ? Boolean(itemInput.isVisible) : undefined,
          },
        });

        const newOrientation = itemInput.customDirection || itemInput.navigationPoint?.orientation;
        if (newOrientation !== undefined && updatedItem.navigationPointId) {
          await prisma.navigationPoint.update({
            where: { id: updatedItem.navigationPointId },
            data: { orientation: newOrientation ? String(newOrientation).trim() : null },
          });
        }

        // Rebuild snapshot for public view
        const fullItem = await prisma.navigationDocumentationItem.findUnique({
          where: { id: itemInput.id },
          include: {
            navigationPoint: true,
            carrier: true,
            selectedPhoto: true,
          },
        });

        if (fullItem) {
          const snapshotData = buildSnapshotItem({
            id: fullItem.id,
            clientNote: fullItem.clientNote,
            customDirection: newOrientation ? String(newOrientation).trim() : null,
            navigationPoint: fullItem.navigationPoint,
            carrier: fullItem.carrier,
            selectedPhoto: fullItem.selectedPhoto
              ? {
                  id: fullItem.selectedPhoto.id,
                  url: `/api/photos/${fullItem.selectedPhoto.id}/file`,
                  createdAt: fullItem.selectedPhoto.createdAt,
                }
              : null,
          });

          await prisma.navigationDocumentationItem.update({
            where: { id: fullItem.id },
            data: { snapshot: snapshotData as unknown as object },
          });
        }
      }
    }

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            navigationPoint: true,
            carrier: { include: { photos: true } },
            selectedPhoto: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při aktualizaci reportu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  const updated = await prisma.navigationDocumentationReport.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });

  return NextResponse.json(updated);
}
