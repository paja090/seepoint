import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const recipientEmail = String(body.recipientEmail || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Zadejte e-mail příjemce.' }, { status: 400 });
    }
    if (!subject || !message) {
      return NextResponse.json({ error: 'Předmět a text e-mailu jsou povinné.' }, { status: 400 });
    }

    const report = await prisma.navigationDocumentationReport.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      message,
      template: 'navigation-documentation',
    });

    const sentAt = new Date();

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id },
      data: {
        status: report.status === 'ARCHIVED' ? 'ARCHIVED' : 'SENT',
        sentAt,
        auditLogs: {
          create: {
            actorUserId: auth.id,
            action: 'EMAIL_SENT',
            recipientEmail,
            tokenExpiresAt: report.tokenExpiresAt,
            message: `E-mail s fotodokumentací odeslán příjemci ${recipientEmail}. Předmět: "${subject}".`,
          },
        },
      },
      include: {
        client: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    return NextResponse.json({
      success: true,
      message: `E-mail byl úspěšně odeslán a zaznamenán v auditu.`,
      report: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chyba při odesílání e-mailu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
