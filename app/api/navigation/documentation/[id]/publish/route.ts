import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, generateSecureToken } from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const report = await prisma.navigationDocumentationReport.findUnique({
      where: { id },
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

    let token: string | undefined;
    let hash = report.publicTokenHash;

    if (!hash) {
      const generated = generateSecureToken();
      token = generated.token;
      hash = generated.hash;
    } else {
      const generated = generateSecureToken();
      token = generated.token;
      hash = generated.hash;
    }

    // Freeze snapshot for each item
    for (const item of report.items) {
      if (item.isVisible === false) continue;

      const snapshotData = buildSnapshotItem({
        id: item.id,
        clientNote: item.clientNote,
        navigationPoint: item.navigationPoint,
        carrier: item.carrier,
        selectedPhoto: item.selectedPhoto,
      });

      await prisma.navigationDocumentationItem.update({
        where: { id: item.id },
        data: {
          snapshot: snapshotData as unknown as object,
        },
      });
    }

    const publishedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt,
        publicTokenHash: hash,
        tokenExpiresAt,
        auditLogs: {
          create: {
            actorUserId: auth.id,
            action: 'PUBLISHED',
            tokenExpiresAt,
            message: `Report byl publikován se zmrazeným snapshotem dat a vygenerovaným přístupovým tokenem.`,
          },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    const publicUrl = token ? `/client/navigation-documentation/${token}` : undefined;

    return NextResponse.json({
      report: updated,
      token,
      publicUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při publikování reportu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
