import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { runPrePublishChecks } from '@/lib/navigation-documentation';

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
          navigationPoint: true,
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
    const points = await prisma.navigationPoint.findMany({
      where: {
        navigationOffer: {
          offer: { clientId },
        },
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
        selectedPhotoId: point.carrier?.photos[0]?.id ?? undefined,
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
              navigationPoint: true,
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
      }
    }
  }

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
        await prisma.navigationDocumentationItem.update({
          where: { id: itemInput.id },
          data: {
            selectedPhotoId: itemInput.selectedPhotoId !== undefined ? itemInput.selectedPhotoId : undefined,
            clientNote: itemInput.clientNote !== undefined ? itemInput.clientNote : undefined,
            sortOrder: itemInput.sortOrder !== undefined ? Number(itemInput.sortOrder) : undefined,
            isVisible: itemInput.isVisible !== undefined ? Boolean(itemInput.isVisible) : undefined,
          },
        });
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
