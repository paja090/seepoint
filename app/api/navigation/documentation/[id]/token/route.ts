import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { generateSecureToken } from '@/lib/navigation-documentation';
import {
  isPublicNavigationReportStatus,
  NavigationDocumentationValidationError,
  parseTokenExpiry,
} from '@/lib/navigation-documentation-policy';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const action = String(body.action || 'regenerate');
    if (action !== 'regenerate' && action !== 'revoke') {
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

    const { token, hash } = generateSecureToken();
    const tokenExpiresAt = parseTokenExpiry(body.tokenExpiresAt);

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id, organizationId: auth.organizationId },
      data: {
        publicTokenHash: hash,
        tokenExpiresAt,
        auditLogs: {
          create: {
            actorUserId: auth.id,
            action: 'TOKEN_REGENERATED',
            tokenExpiresAt,
            message: 'Vygenerován nový přístupový token s obnovenou platností.',
          },
        },
      },
    });

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
