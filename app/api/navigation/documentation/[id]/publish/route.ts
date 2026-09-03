import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, generateSecureToken, runPrePublishChecks } from '@/lib/navigation-documentation';

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
            selectedPhoto: true,
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
    const blockers = warnings.filter((warning) =>
      warning.type === 'EMPTY_REPORT' || warning.type === 'MISSING_PHOTO' || warning.type === 'UNAPPROVED_PHOTO',
    );
    if (blockers.length > 0) {
      return NextResponse.json({ error: 'Report nesplňuje podmínky pro publikování.', warnings }, { status: 422 });
    }

    const { token, hash } = generateSecureToken();

    // Freeze snapshot for each item
    const publishedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const updated = await prisma.$transaction(async (tx) => {
      for (const item of report.items) {
        if (!item.isVisible) continue;
        const snapshotData = buildSnapshotItem({
          id: item.id,
          clientNote: item.clientNote,
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
