import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deleteResendDomain } from '@/lib/resend-service';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';

/**
 * GET /api/settings/email
 * Retrieves tenant's email configuration, DNS records, verification status,
 * and recent delivery logs.
 */
export async function GET() {
  const user = await requireApiAccess('settings');
  if (isApiDenied(user)) return user;

  return runWithTenantContext(
    {
      organizationId: user.organizationId,
      userId: user.id,
      source: 'session',
    },
    async () => {
      const [settings, recentLogs] = await Promise.all([
        prisma.organizationEmailSettings.findUnique({
          where: { organizationId: user.organizationId },
          select: {
            id: true,
            domain: true,
            senderName: true,
            fromEmail: true,
            replyTo: true,
            providerDomainId: true,
            status: true,
            dnsRecords: true,
            lastVerifiedAt: true,
            lastTestedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.emailLog.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { sentAt: 'desc' },
          take: 15,
          select: {
            id: true,
            recipient: true,
            from: true,
            subject: true,
            template: true,
            status: true,
            error: true,
            sentAt: true,
            deliveredAt: true,
          },
        }),
      ]);

      const hasSystemResendKey = Boolean(process.env.RESEND_API_KEY?.trim());

      return NextResponse.json({
        configured: Boolean(settings),
        hasSystemResendKey,
        settings,
        recentLogs,
      });
    }
  );
}

/**
 * DELETE /api/settings/email
 * Disconnects and deletes domain configuration for current tenant.
 */
export async function DELETE() {
  const user = await requireApiAccess('settings');
  if (isApiDenied(user)) return user;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nastavení e-mailu může odpojit pouze administrátor.' }, { status: 403 });
  }

  return runWithTenantContext(
    {
      organizationId: user.organizationId,
      userId: user.id,
      source: 'session',
    },
    async () => {
      const settings = await prisma.organizationEmailSettings.findUnique({
        where: { organizationId: user.organizationId },
      });

      if (!settings) {
        return NextResponse.json({ error: 'Organizace nemá připojenou žádnou doménu.' }, { status: 404 });
      }

      if (settings.providerDomainId) {
        try {
          await deleteResendDomain(settings.providerDomainId);
        } catch (err) {
          console.warn('[email-settings] Error deleting domain from Resend:', err);
        }
      }

      await prisma.organizationEmailSettings.delete({
        where: { id: settings.id },
      });

      return NextResponse.json({ success: true, message: 'Doména byla úspěšně odpojena.' });
    }
  );
}
