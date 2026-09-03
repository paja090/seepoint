import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, runPrePublishChecks } from '@/lib/navigation-documentation';
import {
  NavigationDocumentationValidationError,
  parseOptionalText,
  parseQuarter,
  parseReportYear,
  parseRequiredText,
} from '@/lib/navigation-documentation-policy';

const clientPhotoWhere = { isPrivate: false, isClientVisible: true } as const;
const photoOrder = [{ isPrimary: 'desc' as const }, { createdAt: 'desc' as const }];
const reportInclude = {
  client: { select: { id: true, name: true, email: true, logoFileName: true } },
  offer: { select: { id: true, campaignName: true, title: true } },
  navigationOffer: { select: { id: true, targetName: true, targetAddress: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  auditLogs: { include: { actorUser: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' as const } },
  items: {
    include: {
      navigationPoint: {
        include: {
          carrier: {
            include: {
              photos: { where: clientPhotoWhere, orderBy: photoOrder },
              surfaces: { include: { photos: { where: clientPhotoWhere, orderBy: photoOrder } } },
            },
          },
        },
      },
      carrier: {
        include: {
          photos: { where: clientPhotoWhere, orderBy: photoOrder },
          surfaces: { include: { photos: { where: clientPhotoWhere, orderBy: photoOrder } } },
        },
      },
      selectedPhoto: true,
    },
    orderBy: { sortOrder: 'asc' as const },
    take: 250,
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const report = await prisma.navigationDocumentationReport.findFirst({
    where: { id, organizationId: auth.organizationId },
    include: reportInclude,
  });
  if (!report) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });

  const items = report.items.map((item) => {
    const carrier = item.carrier || item.navigationPoint?.carrier;
    const mergedPhotos = carrier
      ? Array.from(new Map([...carrier.photos, ...carrier.surfaces.flatMap((surface) => surface.photos)].map((photo) => [photo.id, photo])).values())
      : [];
    return {
      ...item,
      carrierId: item.carrierId || item.navigationPoint?.carrierId || null,
      carrier: carrier ? { ...carrier, photos: mergedPhotos } : null,
      customDirection:
        item.snapshot && typeof item.snapshot === 'object' && 'direction' in item.snapshot
          ? String(item.snapshot.direction || '')
          : item.navigationPoint?.orientation || null,
    };
  });

  return NextResponse.json({ ...report, items, warnings: runPrePublishChecks(report.client.email, items, report.periodFrom) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    if (existing.status === 'ARCHIVED') return NextResponse.json({ error: 'Archivovaný report nelze upravovat.' }, { status: 409 });

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = parseRequiredText(body.title, 'Název reportu', 240);
    if (body.description !== undefined) updateData.description = parseOptionalText(body.description, 'Popis', 4_000);
    if (body.quarter !== undefined) updateData.quarter = parseQuarter(body.quarter);
    if (body.year !== undefined) updateData.year = parseReportYear(body.year);
    const itemInputs = Array.isArray(body.items) ? body.items.slice(0, 250) : [];

    await prisma.$transaction(async (tx) => {
      for (const input of itemInputs) {
        const itemId = parseRequiredText(input?.id, 'Položka', 100);
        const item = await tx.navigationDocumentationItem.findFirst({
          where: { id: itemId, reportId: id, organizationId: auth.organizationId },
          select: {
            id: true,
            carrierId: true,
            navigationPoint: { select: { carrierId: true } },
            clientNote: true,
            navigationPointId: true,
            carrier: true,
          },
        });
        if (!item) throw new NavigationDocumentationValidationError('Položka do tohoto reportu nepatří.');

        const selectedPhotoId = input.selectedPhotoId ? parseRequiredText(input.selectedPhotoId, 'Fotografie', 100) : null;
        let selectedPhoto = null;
        if (selectedPhotoId) {
          const carrierId = item.carrierId || item.navigationPoint?.carrierId;
          if (!carrierId) throw new NavigationDocumentationValidationError('Položka není připojena k nosiči.');
          selectedPhoto = await tx.photo.findFirst({
            where: {
              id: selectedPhotoId,
              organizationId: auth.organizationId,
              isPrivate: false,
              isClientVisible: true,
              OR: [{ carrierId }, { surface: { carrierId } }],
            },
          });
          if (!selectedPhoto) throw new NavigationDocumentationValidationError('Vybraná fotografie není schválená pro klienta nebo nepatří k nosiči.');
        }

        const clientNote = input.clientNote !== undefined ? parseOptionalText(input.clientNote, 'Poznámka', 1_000) : item.clientNote;
        const customDirection = parseOptionalText(input.customDirection, 'Směr', 200);
        const sortOrder = input.sortOrder === undefined ? undefined : Number(input.sortOrder);
        if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000)) {
          throw new NavigationDocumentationValidationError('Pořadí položky není platné.');
        }
        const navigationPoint = item.navigationPointId
          ? await tx.navigationPoint.findFirst({ where: { id: item.navigationPointId, organizationId: auth.organizationId } })
          : null;
        const snapshot = buildSnapshotItem({ id: item.id, clientNote, customDirection, navigationPoint, carrier: item.carrier, selectedPhoto });

        await tx.navigationDocumentationItem.update({
          where: { id: item.id, organizationId: auth.organizationId },
          data: {
            selectedPhotoId,
            clientNote,
            sortOrder,
            isVisible: input.isVisible === undefined ? undefined : Boolean(input.isVisible),
            snapshot: snapshot as unknown as object,
          },
        });
      }

      const invalidatesPublication = itemInputs.length > 0 || Object.keys(updateData).length > 0;
      await tx.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          ...updateData,
          ...(invalidatesPublication && (existing.status === 'PUBLISHED' || existing.status === 'SENT')
            ? { status: 'REVIEW', publicTokenHash: null, tokenExpiresAt: new Date(), sentAt: null }
            : {}),
          ...(invalidatesPublication
            ? {
                auditLogs: {
                  create: {
                    organizationId: auth.organizationId,
                    actorUserId: auth.id,
                    action: 'UPDATED',
                    message: existing.status === 'PUBLISHED' || existing.status === 'SENT'
                      ? 'Report byl upraven; veřejný odkaz byl zneplatněn a report čeká na nové publikování.'
                      : 'Koncept reportu byl upraven.',
                  },
                },
              }
            : {}),
        },
      });
    }, { isolationLevel: 'Serializable' });

    const updated = await prisma.navigationDocumentationReport.findFirst({ where: { id, organizationId: auth.organizationId }, include: reportInclude });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof NavigationDocumentationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[navigation/documentation/detail] Update failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report se nepodařilo aktualizovat.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const result = await prisma.navigationDocumentationReport.updateMany({
    where: { id, organizationId: auth.organizationId },
    data: { status: 'ARCHIVED', publicTokenHash: null, tokenExpiresAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
