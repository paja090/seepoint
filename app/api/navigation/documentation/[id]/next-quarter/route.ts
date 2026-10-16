import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  buildSnapshotItem,
  documentationPhotoSelect,
  isSurfaceForClients,
  resolveDocumentationPhotos,
  resolveDocumentationDirection,
} from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const existing = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: { client: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    let nextQuarter = (existing.quarter ?? 1) + 1;
    let nextYear = existing.year;
    if (nextQuarter > 4) {
      nextQuarter = 1;
      nextYear += 1;
    }

    const title = `Fotodokumentace ${nextQuarter}. čtvrtletí ${nextYear}`;
    const periodFrom = new Date(nextYear, (nextQuarter - 1) * 3, 1);
    const periodTo = new Date(nextYear, nextQuarter * 3, 0);

    const duplicate = await prisma.navigationDocumentationReport.findFirst({
      where: {
        organizationId: auth.organizationId,
        clientId: existing.clientId,
        offerId: existing.offerId,
        quarter: nextQuarter,
        year: nextYear,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Report pro stejného klienta, nabídku a čtvrtletí již existuje.', reportId: duplicate.id }, { status: 409 });
    }

    const allClientIds = [existing.clientId];

    const pointInclude = {
      installedPhoto: { select: documentationPhotoSelect },
      sitePhoto: { select: documentationPhotoSelect },
      surface: {
        include: {
          photos: {
            where: { isPrivate: false },
            orderBy: [{ isClientVisible: 'desc' as const }, { isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
            select: documentationPhotoSelect,
          },
          occupancies: {
            select: { clientId: true },
          },
        },
      },
      carrier: {
        include: {
          photos: {
            where: { isPrivate: false },
            orderBy: [{ isClientVisible: 'desc' as const }, { isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
            select: documentationPhotoSelect,
          },
          surfaces: {
            include: {
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isClientVisible: 'desc' as const }, { isPrimary: 'desc' as const }, { createdAt: 'desc' as const }],
                select: documentationPhotoSelect,
              },
              occupancies: {
                select: { clientId: true },
              },
            },
          },
        },
      },
    };

    // Re-query current live active navigation points & latest photos
    let points = await prisma.navigationPoint.findMany({
      where: {
        organizationId: auth.organizationId,
        navigationOrder: {
          crmOrder: {
            clientId: { in: allClientIds },
            ...(existing.offerId ? { offerId: existing.offerId } : {}),
          },
        },
        status: { notIn: ['REMOVED', 'CANCELLED'] },
      },
      include: pointInclude,
      orderBy: { sortOrder: 'asc' },
    });

    if (points.length === 0) {
      points = await prisma.navigationPoint.findMany({
        where: {
          organizationId: auth.organizationId,
          navigationOffer: {
            offer: {
              clientId: { in: allClientIds },
              ...(existing.offerId ? { id: existing.offerId } : {}),
            },
          },
          status: { notIn: ['REMOVED', 'CANCELLED'] },
        },
        include: pointInclude,
        orderBy: { sortOrder: 'asc' },
      });
    }

    let itemInputs: Array<{
      navigationPointId?: string;
      carrierId?: string;
      selectedPhotoId?: string;
      customDirection?: string;
      sortOrder: number;
      isVisible: boolean;
      snapshot?: object;
    }> = [];

    if (points.length > 0) {
      itemInputs = points.map((point, index) => {
        const { selectedPhoto } = resolveDocumentationPhotos({
          point,
          carrier: point.carrier ?? null,
          allClientIds,
        });

        const customDirection = resolveDocumentationDirection({
          point,
          carrier: point.carrier ?? null,
          allClientIds,
        });

        const snapshot = buildSnapshotItem({
          id: `item-${index}`,
          clientNote: null,
          customDirection,
          surface: point.surface ?? null,
          navigationPoint: point,
          carrier: point.carrier ?? null,
          selectedPhoto,
        });

        return {
          navigationPointId: point.id,
          carrierId: point.carrierId ?? undefined,
          selectedPhotoId: selectedPhoto?.id ?? undefined,
          customDirection,
          sortOrder: index,
          isVisible: true,
          snapshot: snapshot as unknown as object,
        };
      });
    } else {
      const carriers = await prisma.advertisingCarrier.findMany({
        where: {
          organizationId: auth.organizationId,
          archivedAt: null,
          surfaces: {
            some: {
              OR: [
                { currentClientId: { in: allClientIds } },
                { occupancies: { some: { clientId: { in: allClientIds } } } },
              ],
            },
          },
        },
        include: {
          photos: {
            where: { isPrivate: false },
            orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
            select: documentationPhotoSelect,
          },
          surfaces: {
            include: {
              photos: {
                where: { isPrivate: false },
                orderBy: [{ isClientVisible: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
                select: documentationPhotoSelect,
              },
              occupancies: {
                select: { clientId: true },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
        take: 100,
      });

      let sortOrderIdx = 0;
      for (const carrier of carriers) {
        const clientSurfaces = (carrier.surfaces || []).filter((surface) =>
          isSurfaceForClients(surface, allClientIds)
        );

        if (clientSurfaces.length > 0) {
          for (const surface of clientSurfaces) {
            const { selectedPhoto } = resolveDocumentationPhotos({
              surface,
              carrier,
              allClientIds,
            });
            const customDirection = resolveDocumentationDirection({
              surface,
              carrier,
              allClientIds,
            });
            const snapshot = buildSnapshotItem({
              id: `item-${sortOrderIdx}`,
              clientNote: null,
              customDirection,
              surface,
              navigationPoint: null,
              carrier,
              selectedPhoto,
            });

            itemInputs.push({
              carrierId: carrier.id,
              selectedPhotoId: selectedPhoto?.id ?? undefined,
              customDirection,
              sortOrder: sortOrderIdx++,
              isVisible: true,
              snapshot: snapshot as unknown as object,
            });
          }
        }
      }
    }

    const newReport = await prisma.navigationDocumentationReport.create({
      data: {
        organizationId: auth.organizationId,
        clientId: existing.clientId,
        offerId: existing.offerId,
        navigationOfferId: existing.navigationOfferId,
        title,
        description: existing.description,
        periodFrom,
        periodTo,
        quarter: nextQuarter,
        year: nextYear,
        status: 'DRAFT',
        createdById: auth.id,
        items: {
          create: itemInputs.map(({ customDirection, snapshot, ...item }) => ({
            ...item,
            organizationId: auth.organizationId,
            snapshot: snapshot ?? (customDirection ? { direction: customDirection } : undefined),
          })),
        },
        auditLogs: {
          create: {
            organizationId: auth.organizationId,
            actorUserId: auth.id,
            action: 'CREATED',
            message: `Vytvořen nový koncept pro ${nextQuarter}. čtvrtletí ${nextYear} na základě předchozího reportu ${existing.title}. Znovu načtena živá data s izolací reklamních ploch.`,
          },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    return NextResponse.json({ report: newReport }, { status: 201 });
  } catch (error: unknown) {
    console.error('[navigation/documentation/next-quarter] Creation failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report pro další čtvrtletí se nepodařilo vytvořit.' }, { status: 500 });
  }
}
