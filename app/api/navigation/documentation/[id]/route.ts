import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, documentationPhotoSelect, getDeterministicReportToken, runPrePublishChecks } from '@/lib/navigation-documentation';
import {
  isPublicNavigationReportStatus,
  NavigationDocumentationValidationError,
  parseOptionalText,
  parseQuarter,
  parseReportYear,
  parseRequiredText,
} from '@/lib/navigation-documentation-policy';

const clientPhotoWhere = { isPrivate: false } as const;
const photoOrder = [{ isClientVisible: 'desc' as const }, { isPrimary: 'desc' as const }, { createdAt: 'desc' as const }];
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
          installedPhoto: { select: documentationPhotoSelect },
          sitePhoto: { select: documentationPhotoSelect },
          carrier: {
            include: {
              photos: { where: clientPhotoWhere, orderBy: photoOrder, select: documentationPhotoSelect },
              surfaces: { include: { photos: { where: clientPhotoWhere, orderBy: photoOrder, select: documentationPhotoSelect } } },
            },
          },
        },
      },
      carrier: {
        include: {
          photos: { where: clientPhotoWhere, orderBy: photoOrder, select: documentationPhotoSelect },
          surfaces: { include: { photos: { where: clientPhotoWhere, orderBy: photoOrder, select: documentationPhotoSelect } } },
        },
      },
      selectedPhoto: { select: documentationPhotoSelect },
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
    const pointPhotos = [
      ...(item.navigationPoint?.installedPhoto && !item.navigationPoint.installedPhoto.isPrivate ? [item.navigationPoint.installedPhoto] : []),
      ...(item.navigationPoint?.sitePhoto && !item.navigationPoint.sitePhoto.isPrivate ? [item.navigationPoint.sitePhoto] : []),
    ];
    const rawPhotos = [
      ...pointPhotos,
      ...(carrier ? [...carrier.photos, ...carrier.surfaces.flatMap((surface) => surface.photos)] : []),
    ];
    const mergedPhotos = Array.from(new Map(rawPhotos.map((photo) => [photo.id, photo])).values());
    return {
      ...item,
      carrierId: item.carrierId || item.navigationPoint?.carrierId || null,
      carrier: carrier ? { ...carrier, photos: mergedPhotos } : (mergedPhotos.length > 0 ? { id: 'virtual', code: item.navigationPoint?.label || 'Navigace', city: '', address: item.navigationPoint?.address || '', photos: mergedPhotos, surfaces: [] } : null),
      customDirection:
        item.snapshot && typeof item.snapshot === 'object' && 'direction' in item.snapshot
          ? String(item.snapshot.direction || '')
          : item.navigationPoint?.orientation || null,
    };
  });

  const { token, hash } = getDeterministicReportToken(report.id);
  const isArchived = report.status === 'ARCHIVED';
  const effectiveStatus = !isArchived && !isPublicNavigationReportStatus(report.status) ? 'PUBLISHED' : report.status;
  const publicUrl = !isArchived ? `/client/navigation-documentation/${token}` : null;

  if (!isArchived && (report.publicTokenHash !== hash || report.status !== effectiveStatus || !report.publishedAt)) {
    const now = new Date();
    const expiresAt = report.tokenExpiresAt && report.tokenExpiresAt > now
      ? report.tokenExpiresAt
      : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await prisma.navigationDocumentationReport.update({
      where: { id: report.id },
      data: {
        publicTokenHash: hash,
        status: effectiveStatus,
        publishedAt: report.publishedAt || now,
        tokenExpiresAt: expiresAt,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    ...report,
    status: effectiveStatus,
    items,
    token: !isArchived ? token : null,
    publicUrl,
    warnings: runPrePublishChecks(report.client.email, items, report.periodFrom),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: { id: true, status: true, publishedAt: true },
    });
    if (!existing) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    if (existing.status === 'ARCHIVED') return NextResponse.json({ error: 'Archivovaný report nelze upravovat.' }, { status: 409 });

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = parseRequiredText(body.title, 'Název reportu', 240);
    if (body.description !== undefined) updateData.description = parseOptionalText(body.description, 'Popis', 4_000);
    if (body.quarter !== undefined) updateData.quarter = parseQuarter(body.quarter);
    if (body.year !== undefined) updateData.year = parseReportYear(body.year);
    const itemInputs = Array.isArray(body.items) ? body.items.slice(0, 250) : [];

    const { token, hash } = getDeterministicReportToken(id);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

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
          selectedPhoto = await tx.photo.findFirst({
            where: {
              id: selectedPhotoId,
              organizationId: auth.organizationId,
              isPrivate: false,
            },
            select: documentationPhotoSelect,
          });
          if (!selectedPhoto) throw new NavigationDocumentationValidationError('Vybraná fotografie nebyla nalezena nebo je soukromá.');
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

      const hasChanges = itemInputs.length > 0 || Object.keys(updateData).length > 0;
      await tx.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          ...updateData,
          status: existing.status === 'SENT' ? 'SENT' : 'PUBLISHED',
          publicTokenHash: hash,
          publishedAt: existing.publishedAt || now,
          tokenExpiresAt: expiresAt,
          ...(hasChanges
            ? {
                auditLogs: {
                  create: {
                    organizationId: auth.organizationId,
                    actorUserId: auth.id,
                    action: 'UPDATED',
                    message: 'Report byl upraven a veřejný odkaz aktualizován.',
                  },
                },
              }
            : {}),
        },
      });
    }, { isolationLevel: 'Serializable' });

    const updated = await prisma.navigationDocumentationReport.findFirst({ where: { id, organizationId: auth.organizationId }, include: reportInclude });
    return NextResponse.json({ ...updated, token, publicUrl: `/client/navigation-documentation/${token}` });
  } catch (error) {
    if (error instanceof NavigationDocumentationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[navigation/documentation/detail] Update failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report se nepodařilo aktualizovat.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  if (permanent) {
    const existing = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.navigationDocumentationItem.deleteMany({ where: { reportId: id, organizationId: auth.organizationId } });
      await tx.navigationReportAuditLog.deleteMany({ where: { reportId: id, organizationId: auth.organizationId } });
      await tx.navigationDocumentationReport.deleteMany({ where: { id, organizationId: auth.organizationId } });
    });

    return NextResponse.json({ success: true, deleted: true });
  }

  const result = await prisma.navigationDocumentationReport.updateMany({
    where: { id, organizationId: auth.organizationId },
    data: { status: 'ARCHIVED', publicTokenHash: null, tokenExpiresAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
  return NextResponse.json({ success: true, archived: true });
}
