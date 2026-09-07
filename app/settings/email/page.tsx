import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { EmailSettingsView } from '@/components/settings/EmailSettingsView';

export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const user = await requirePageAccess('settings');

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

  const serializedSettings = settings
    ? {
        ...settings,
        dnsRecords: settings.dnsRecords as any,
        lastVerifiedAt: settings.lastVerifiedAt?.toISOString() || null,
        lastTestedAt: settings.lastTestedAt?.toISOString() || null,
        createdAt: settings.createdAt.toISOString(),
      }
    : null;

  const serializedLogs = recentLogs.map((log) => ({
    ...log,
    sentAt: log.sentAt.toISOString(),
    deliveredAt: log.deliveredAt?.toISOString() || null,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Firemní e-mail & DNS</h1>
          <p className="mt-2 text-sm text-slate-600">
            Správa odesílací domény pro nabídky, klientské zprávy a systémové notifikace s ověřením SPF a DKIM.
          </p>
        </div>

        <EmailSettingsView
          initialSettings={serializedSettings}
          initialLogs={serializedLogs}
          userEmail={user.email}
        />
      </div>
    </AppShell>
  );
}
