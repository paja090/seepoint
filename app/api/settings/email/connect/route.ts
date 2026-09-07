import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { registerResendDomain } from '@/lib/resend-service';
import { isValidEmailAddress } from '@/lib/email-policy';
import { runWithTenantContext } from '@/lib/tenant-context';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

/**
 * POST /api/settings/email/connect
 * Registers a new custom domain in Resend for the current tenant and stores DNS records.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('settings');
  if (isApiDenied(user)) return user;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Připojit doménu může pouze administrátor organizace.' }, { status: 403 });
  }

  const limited = await enforceRateLimit(
    request,
    hashRateLimitIdentity(`${user.organizationId}:${user.id}`),
    rateLimitPolicies.emailSettingsMutation
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
        const rawDomain = typeof body?.domain === 'string' ? body.domain : '';
        const rawSenderName = typeof body?.senderName === 'string' ? body.senderName : '';
        const rawFromEmail = typeof body?.fromEmail === 'string' ? body.fromEmail : '';
        const rawReplyTo = typeof body?.replyTo === 'string' ? body.replyTo : '';
        const rawResendApiKey = typeof body?.resendApiKey === 'string' ? body.resendApiKey : undefined;

        const cleanDomain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        const cleanSenderName = rawSenderName.trim();
        const cleanFromEmail = rawFromEmail.trim().toLowerCase();
        const cleanResendApiKey = rawResendApiKey?.trim().replace(/^["']|["']$/g, '');

        if (!cleanDomain || !cleanDomain.includes('.') || cleanDomain.length > 120) {
          return NextResponse.json({ error: 'Zadejte platný název domény (např. seepoint.cz).' }, { status: 400 });
        }

        if (!cleanSenderName || cleanSenderName.length > 80) {
          return NextResponse.json({ error: 'Zadejte platné jméno odesílatele (max 80 znaků).' }, { status: 400 });
        }

        if (!isValidEmailAddress(cleanFromEmail)) {
          return NextResponse.json({ error: 'E-mail odesílatele nemá platný formát.' }, { status: 400 });
        }

        if (!cleanFromEmail.endsWith(`@${cleanDomain}`)) {
          return NextResponse.json({
            error: `E-mail odesílatele (${cleanFromEmail}) musí patřit k připojované doméně (@${cleanDomain}).`,
          }, { status: 400 });
        }

        let cleanReplyTo: string | null = null;
        const trimmedReplyTo = rawReplyTo.trim().toLowerCase();
        if (trimmedReplyTo) {
          if (!isValidEmailAddress(trimmedReplyTo)) {
            return NextResponse.json({ error: 'Reply-To e-mail nemá platný formát.' }, { status: 400 });
          }
          cleanReplyTo = trimmedReplyTo;
        }

        // Register domain via Resend Management API (supports optional key override if Vercel env is missing/stale)
        const resendDomain = await registerResendDomain(cleanDomain, cleanResendApiKey);

        // Upsert into OrganizationEmailSettings
        const saved = await prisma.organizationEmailSettings.upsert({
          where: { organizationId: user.organizationId },
          create: {
            organizationId: user.organizationId,
            domain: cleanDomain,
            senderName: cleanSenderName,
            fromEmail: cleanFromEmail,
            replyTo: cleanReplyTo,
            providerDomainId: resendDomain.id,
            status: resendDomain.status === 'verified' ? 'VERIFIED' : 'PENDING',
            dnsRecords: (resendDomain.records || []) as unknown as object,
          },
          update: {
            domain: cleanDomain,
            senderName: cleanSenderName,
            fromEmail: cleanFromEmail,
            replyTo: cleanReplyTo,
            providerDomainId: resendDomain.id,
            status: resendDomain.status === 'verified' ? 'VERIFIED' : 'PENDING',
            dnsRecords: (resendDomain.records || []) as unknown as object,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Doména byla zaregistrována v Resendu. Vložte prosím vygenerované DNS záznamy u vašeho registrátora.',
          settings: {
            id: saved.id,
            domain: saved.domain,
            senderName: saved.senderName,
            fromEmail: saved.fromEmail,
            replyTo: saved.replyTo,
            providerDomainId: saved.providerDomainId,
            status: saved.status,
            dnsRecords: saved.dnsRecords,
          },
        });
      } catch (err) {
        console.error('[email-connect] Error connecting domain:', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Připojení domény selhalo.' },
          { status: 500 }
        );
      }
    }
  );
}
