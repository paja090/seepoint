import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, documentationPhotoSelect, getDeterministicReportToken, runPrePublishChecks } from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const report = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        client: true,
        items: {
          include: {
            navigationPoint: true,
            carrier: true,
            selectedPhoto: { select: documentationPhotoSelect },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (report.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Archivovaný report nelze publikovat.' }, { status: 409 });
    }

    const warnings = runPrePublishChecks(report.client.email, report.items, report.periodFrom);
    const visibleWithPhoto = report.items.filter((item) => item.isVisible && item.selectedPhoto?.url);
    if (visibleWithPhoto.length === 0) {
      return NextResponse.json({
        error: 'Report musí obsahovat alespoň jednu viditelnou položku s fotografií.',
        warnings,
      }, { status: 422 });
    }
    const blockers = warnings.filter((warning) =>
      warning.type === 'EMPTY_REPORT' || warning.type === 'UNAPPROVED_PHOTO',
    );
    if (blockers.length > 0) {
      return NextResponse.json({ error: 'Report nesplňuje podmínky pro publikování.', warnings }, { status: 422 });
    }

    const { token, hash } = getDeterministicReportToken(id);

    // Freeze snapshot for each item
    const publishedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const updated = await prisma.$transaction(async (tx) => {
      for (const item of report.items) {
        if (!item.isVisible) continue;
        const currentCustomDirection =
          item.snapshot && typeof item.snapshot === 'object' && 'direction' in item.snapshot
            ? String((item.snapshot as Record<string, unknown>).direction || '')
            : item.navigationPoint?.orientation || null;
        const snapshotData = buildSnapshotItem({
          id: item.id,
          clientNote: item.clientNote,
          customDirection: currentCustomDirection,
          navigationPoint: item.navigationPoint,
          carrier: item.carrier,
          selectedPhoto: item.selectedPhoto,
        });
        await tx.navigationDocumentationItem.update({
          where: { id: item.id, organizationId: auth.organizationId },
          data: { snapshot: snapshotData as unknown as object },
        });
      }

      return tx.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          sentAt: null,
          publicTokenHash: hash,
          tokenExpiresAt,
          auditLogs: {
            create: {
              organizationId: auth.organizationId,
              actorUserId: auth.id,
              action: 'PUBLISHED',
              tokenExpiresAt,
              message: 'Report byl publikován se zmrazeným snapshotem dat a novým přístupovým odkazem.',
            },
          },
        },
        include: { client: true, items: true },
      });
    }, { isolationLevel: 'Serializable' });

    const publicUrl = `/client/navigation-documentation/${token}`;

    return NextResponse.json({
      report: updated,
      token,
      publicUrl,
    });
  } catch (error: unknown) {
    console.error('[navigation/documentation/publish] Publishing failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Report se nepodařilo publikovat.' }, { status: 500 });
  }
}
