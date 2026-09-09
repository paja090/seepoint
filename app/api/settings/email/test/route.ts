import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTenantTestEmail } from '@/lib/email';
import { isValidEmailAddress } from '@/lib/email-policy';
import { runWithTenantContext } from '@/lib/tenant-context';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

/**
 * POST /api/settings/email/test
 * Sends a live test email from the tenant's configured domain to verify end-to-end delivery.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('settings');
  if (isApiDenied(user)) return user;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Odeslat testovací e-mail může pouze administrátor.' }, { status: 403 });
  }

  const limited = await enforceRateLimit(
    request,
    hashRateLimitIdentity(`${user.organizationId}:${user.id}`),
    rateLimitPolicies.transactionalEmail
  );
  if (limited) return limited;

  return runWithTenantContext(
    {
      organizationId: user.organizationId,
      userId: user.id,
      source: 'session',
    },
    async () => {
      try {
        const body = await request.json().catch(() => ({}));
        const targetEmail = typeof body.to === 'string' && body.to.trim() ? body.to.trim() : user.email;

        if (!isValidEmailAddress(targetEmail)) {
          return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu příjemce.' }, { status: 400 });
        }

        const settings = await prisma.organizationEmailSettings.findUnique({
          where: { organizationId: user.organizationId },
        });

        if (!settings) {
          return NextResponse.json(
            { error: 'Nejprve připojte firemní doménu.' },
            { status: 400 }
          );
        }

        if (settings.status !== 'VERIFIED') {
          return NextResponse.json(
            { error: 'Nejprve ověřte firemní doménu. Test musí použít jejího skutečného odesílatele.' },
            { status: 409 }
          );
        }

        const result = await sendTenantTestEmail({
          organizationId: user.organizationId,
          to: targetEmail,
          senderName: settings.senderName,
          fromEmail: settings.fromEmail,
          replyTo: settings.replyTo || undefined,
        });

        if (result.status === 'skipped') {
          return NextResponse.json(
            { error: 'V tomto prostředí je odesílání vypnuté. Testovací e-mail nebyl odeslán.', delivery: result },
            { status: 409 }
          );
        }

        await prisma.organizationEmailSettings.update({
          where: { id: settings.id },
          data: { lastTestedAt: new Date() },
        });

        return NextResponse.json({
          success: true,
          message: `Testovací e-mail byl odeslán na ${targetEmail}. Zkontrolujte si doručenou poštu.`,
          delivery: result,
        });
      } catch (err) {
        console.error('[email-test] Error sending test email:', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Odeslání testovacího e-mailu selhalo.' },
          { status: 500 }
        );
      }
    }
  );
}
