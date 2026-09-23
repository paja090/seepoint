import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { getDeterministicReportToken } from '@/lib/navigation-documentation';
import {
  isPublicNavigationReportStatus,
  NavigationDocumentationValidationError,
  parseTokenExpiry,
} from '@/lib/navigation-documentation-policy';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;
  const report = await prisma.navigationDocumentationReport.findFirst({ where: { id, organizationId: auth.organizationId } });
  if (!report) return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
  if (!isPublicNavigationReportStatus(report.status)) {
    return NextResponse.json({ error: 'Odkaz lze zobrazit až po publikování reportu.' }, { status: 409 });
  }

  const { token, hash } = getDeterministicReportToken(id);
  if (report.publicTokenHash !== hash) {
    await prisma.navigationDocumentationReport.update({
      where: { id },
      data: { publicTokenHash: hash },
    });
  }

  return NextResponse.json({
    success: true,
    token,
    publicUrl: `/client/navigation-documentation/${token}`,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const action = String(body.action || 'get');
    if (action !== 'regenerate' && action !== 'revoke' && action !== 'get') {
      return NextResponse.json({ error: 'Neplatná operace s odkazem.' }, { status: 400 });
    }

    const report = await prisma.navigationDocumentationReport.findFirst({ where: { id, organizationId: auth.organizationId } });
    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (!isPublicNavigationReportStatus(report.status)) {
      return NextResponse.json({ error: 'Odkaz lze spravovat až po publikování reportu.' }, { status: 409 });
    }

    if (action === 'revoke') {
      const updated = await prisma.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          publicTokenHash: null,
          tokenExpiresAt: new Date(),
          auditLogs: {
            create: {
              actorUserId: auth.id,
              action: 'TOKEN_REVOKED',
              message: 'Přístupový token byl ručně zneplatněn.',
            },
          },
        },
      });

      return NextResponse.json({ success: true, message: 'Odkaz byl zneplatněn.', report: updated });
    }

    const { token, hash } = getDeterministicReportToken(id);
    const tokenExpiresAt = body.tokenExpiresAt ? parseTokenExpiry(body.tokenExpiresAt) : (report.tokenExpiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    let updated = report;
    if (report.publicTokenHash !== hash || (body.tokenExpiresAt && report.tokenExpiresAt?.getTime() !== tokenExpiresAt.getTime())) {
      updated = await prisma.navigationDocumentationReport.update({
        where: { id, organizationId: auth.organizationId },
        data: {
          publicTokenHash: hash,
          tokenExpiresAt,
          auditLogs: {
            create: {
              actorUserId: auth.id,
              action: action === 'regenerate' ? 'TOKEN_REGENERATED' : 'TOKEN_VIEWED',
              tokenExpiresAt,
              message: action === 'regenerate' ? 'Ověřen trvalý přístupový token s obnovenou platností.' : 'Zobrazen klientský odkaz fotodokumentace.',
            },
          },
        },
      });
    }

    const publicUrl = `/client/navigation-documentation/${token}`;

    return NextResponse.json({
      success: true,
      token,
      publicUrl,
      report: updated,
    });
  } catch (error: unknown) {
    if (error instanceof NavigationDocumentationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[navigation/documentation/token] Token operation failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Chyba při správě odkazu.' }, { status: 500 });
  }
}
