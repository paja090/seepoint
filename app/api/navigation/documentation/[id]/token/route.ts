import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { generateSecureToken } from '@/lib/navigation-documentation';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const action = String(body.action || 'regenerate');

    const report = await prisma.navigationDocumentationReport.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (action === 'revoke') {
      const updated = await prisma.navigationDocumentationReport.update({
        where: { id },
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
    const tokenExpiresAt = body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id },
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
    const message = error instanceof Error ? error.message : 'Chyba při správě tokenu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
