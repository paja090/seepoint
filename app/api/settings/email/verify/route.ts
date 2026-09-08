import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { verifyResendDomain, createDomainSendingKey } from '@/lib/resend-service';
import { encryptTenantCredential } from '@/lib/email-encryption';
import { runWithTenantContext } from '@/lib/tenant-context';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

/**
 * POST /api/settings/email/verify
 * Triggers DNS verification in Resend.
 * If verified, creates and encrypts a domain-scoped sending credential.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('settings');
  if (isApiDenied(user)) return user;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Ověřit doménu může pouze administrátor.' }, { status: 403 });
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
        const rawResendApiKey = typeof body?.resendApiKey === 'string' ? body.resendApiKey : undefined;
        const cleanResendApiKey = rawResendApiKey?.trim().replace(/^["']|["']$/g, '');

        const settings = await prisma.organizationEmailSettings.findUnique({
          where: { organizationId: user.organizationId },
        });

        if (!settings || !settings.providerDomainId) {
          return NextResponse.json(
            { error: 'Pro tuto organizaci zatím nebyla zadána žádná doména.' },
            { status: 400 }
          );
        }

        // Call Resend verify
        const verifiedDomain = await verifyResendDomain(settings.providerDomainId, cleanResendApiKey);
        const isVerified = verifiedDomain.status === 'verified';

        let encryptedKey: string | null = settings.encryptedSendingApiKey;

        // If verified and we don't have a domain-scoped key yet, create and encrypt one
        if (isVerified && !encryptedKey) {
          try {
            const keyResponse = await createDomainSendingKey(settings.providerDomainId, settings.domain, cleanResendApiKey);
            if (keyResponse.token) {
              encryptedKey = encryptTenantCredential(keyResponse.token);
            }
          } catch (keyErr) {
            console.error('[email-verify] Failed creating domain sending key:', keyErr);
          }
        }

        const recordsToSave =
          verifiedDomain.records && verifiedDomain.records.length > 0
            ? verifiedDomain.records
            : ((settings.dnsRecords as unknown[]) || []);

        const updated = await prisma.organizationEmailSettings.update({
          where: { id: settings.id },
          data: {
            status: isVerified ? 'VERIFIED' : 'PENDING',
            dnsRecords: recordsToSave as unknown as object,
            encryptedSendingApiKey: encryptedKey || undefined,
            lastVerifiedAt: isVerified ? new Date() : settings.lastVerifiedAt,
          },
        });

        if (isVerified) {
          return NextResponse.json({
            success: true,
            verified: true,
            message: 'Doména byla úspěšně ověřena v DNS! Firemní e-mail je připraven k odesílání.',
            settings: {
              id: updated.id,
              domain: updated.domain,
              senderName: updated.senderName,
              fromEmail: updated.fromEmail,
              replyTo: updated.replyTo,
              status: updated.status,
              dnsRecords: updated.dnsRecords,
              lastVerifiedAt: updated.lastVerifiedAt,
            },
          });
        }

        return NextResponse.json({
          success: true,
          verified: false,
          message: 'DNS záznamy se zatím nepodařilo ověřit. Počkejte prosím na propagaci DNS (může trvat několik minut až hodin) a zkuste to znovu.',
          settings: {
            id: updated.id,
            domain: updated.domain,
            senderName: updated.senderName,
            fromEmail: updated.fromEmail,
            replyTo: updated.replyTo,
            status: updated.status,
            dnsRecords: updated.dnsRecords,
          },
        });
      } catch (err) {
        console.error('[email-verify] Error verifying domain:', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Ověření domény selhalo.' },
          { status: 500 }
        );
      }
    }
  );
}
