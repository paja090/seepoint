import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyResendWebhookSignature } from '@/lib/resend-service';
import { runWithTenantContext } from '@/lib/tenant-context';
import type { EmailLogStatus } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * Resend Delivery & Domain Webhook Handler
 * 
 * Verifies Svix cryptographic signature and updates EmailLog statuses
 * and offer delivery tracking in real-time.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    const isValid = verifyResendWebhookSignature(rawBody, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    });

    if (!isValid) {
      console.warn('[webhook] Resend webhook signature verification failed');
      return NextResponse.json({ error: 'Neplatný podpis webhooku.' }, { status: 401 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Neplatné JSON tělo požadavku.' }, { status: 400 });
    }

    const eventType = String(payload.type || '');
    const data = (payload.data as Record<string, unknown>) || {};
    const emailId = typeof data.email_id === 'string' ? data.email_id : typeof data.id === 'string' ? data.id : null;

    if (eventType.startsWith('email.') && emailId) {
      const emailLog = await prisma.emailLog.findUnique({
        where: { providerMessageId: emailId },
      });

      if (emailLog) {
        let nextStatus: EmailLogStatus = emailLog.status;
        let deliveredAt: Date | undefined = undefined;
        let errorMsg: string | undefined = undefined;

        switch (eventType) {
          case 'email.sent':
            nextStatus = 'SENT';
            break;
          case 'email.delivered':
            nextStatus = 'DELIVERED';
            deliveredAt = new Date();
            break;
          case 'email.delivery_delayed':
            nextStatus = 'DELIVERY_DELAYED';
            break;
          case 'email.bounced':
            nextStatus = 'BOUNCED';
            errorMsg = (data.bounce as Record<string, unknown>)?.message as string || 'Zpráva byla poskytovatelem odmítnuta (bounced).';
            break;
          case 'email.complained':
            nextStatus = 'COMPLAINED';
            errorMsg = 'Příjemce označil zprávu jako spam.';
            break;
          default:
            break;
        }

        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: nextStatus,
            deliveredAt: deliveredAt || undefined,
            error: errorMsg || undefined,
          },
        });

        // If this email is linked to an offer, record an event in tenant context
        const metadata = (emailLog.metadata as Record<string, unknown>) || {};
        if (metadata.offerId && nextStatus === 'DELIVERED') {
          await runWithTenantContext(
            {
              organizationId: emailLog.organizationId,
              userId: 'resend-webhook',
              source: 'session',
            },
            async () => {
              await prisma.offerEvent.create({
                data: {
                  offerId: String(metadata.offerId),
                  type: 'SENT',
                  fromStatus: 'SENT',
                  toStatus: 'SENT',
                  actorName: 'Resend Webhook',
                  message: `Nabídka byla úspěšně doručena do schránky ${emailLog.recipient}.`,
                  metadata: { emailLogId: emailLog.id, providerMessageId: emailId, status: 'DELIVERED' },
                },
              }).catch(() => null);
            }
          );
        }
      }
    } else if (eventType.startsWith('domain.') && data.id) {
      const providerDomainId = String(data.id);
      const domainStatus = String(data.status || '').toLowerCase();

      const settings = await prisma.organizationEmailSettings.findFirst({
        where: { providerDomainId },
      });

      if (settings) {
        let nextDomainStatus = settings.status;
        if (domainStatus === 'verified') nextDomainStatus = 'VERIFIED';
        else if (domainStatus === 'failed') nextDomainStatus = 'FAILED';
        else if (domainStatus === 'pending') nextDomainStatus = 'PENDING';

        await prisma.organizationEmailSettings.update({
          where: { id: settings.id },
          data: {
            status: nextDomainStatus,
            lastVerifiedAt: domainStatus === 'verified' ? new Date() : undefined,
          },
        });
      }
    }

    return NextResponse.json({ received: true, type: eventType });
  } catch (err) {
    console.error('[webhook] Resend webhook processing error:', err);
    return NextResponse.json({ error: 'Chyba při zpracování webhooku.' }, { status: 500 });
  }
}
