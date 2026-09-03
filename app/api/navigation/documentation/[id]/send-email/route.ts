import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import {
  isPublicNavigationReportStatus,
  NavigationDocumentationValidationError,
  parseRecipientEmail,
  parseRequiredText,
} from '@/lib/navigation-documentation-policy';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${auth.organizationId}:${auth.id}`), rateLimitPolicies.transactionalEmail);
  if (limited) return limited;

  const { id } = await params;

  try {
    const body = await request.json();
    const recipientEmail = parseRecipientEmail(body.recipientEmail);
    const subject = parseRequiredText(body.subject, 'Předmět e-mailu', 200);
    const message = parseRequiredText(body.message, 'Text e-mailu', 20_000);

    const report = await prisma.navigationDocumentationReport.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: { client: true },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (!isPublicNavigationReportStatus(report.status) || !report.publicTokenHash) {
      return NextResponse.json({ error: 'Report musí být před odesláním publikovaný.' }, { status: 409 });
    }
    if (!report.tokenExpiresAt || report.tokenExpiresAt <= new Date()) {
      return NextResponse.json({ error: 'Veřejný odkaz není platný. Vygenerujte nový odkaz.' }, { status: 409 });
    }

    const delivery = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      message,
      template: 'navigation-documentation',
      idempotencyKey: `navigation-documentation/${report.id}/${report.updatedAt.getTime()}`,
    });

    if (delivery.status === 'skipped') {
      return NextResponse.json({
        success: true,
        delivered: false,
        message: 'Preview: e-mail nebyl odeslán a report nebyl označen jako odeslaný.',
        report,
      }, { status: 202 });
    }

    const sentAt = new Date();

    const updated = await prisma.navigationDocumentationReport.update({
      where: { id, organizationId: auth.organizationId },
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
      delivered: true,
      message: `E-mail byl úspěšně odeslán a zaznamenán v auditu.`,
      report: updated,
    });
  } catch (error: unknown) {
    if (error instanceof NavigationDocumentationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[navigation/documentation/email] Delivery failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'E-mail se nepodařilo odeslat. Zkuste to prosím znovu.' }, { status: 500 });
  }
}
