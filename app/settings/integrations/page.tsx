import { AppShell } from '@/components/AppShell';
import { GoogleIntegrationCard } from '@/components/GoogleIntegrationCard';
import { GmailIntegrationCard, type GmailConnectionItem } from '@/components/GmailIntegrationCard';
import { prisma } from '@/lib/db';
import { isGoogleOAuthConfigured } from '@/lib/integrations/google-oauth';
import { requireOrganizationRole } from '@/lib/organization';

export default async function IntegrationsSettingsPage({ searchParams }: { searchParams: Promise<{ google?: string; reason?: string }> }) {
  const { organizationId } = await requireOrganizationRole('ADMIN');
  const [driveConnection, gmailConnectionsRaw] = await Promise.all([
    prisma.integrationConnection.findFirst({
      where: { organizationId, provider: 'GOOGLE_DRIVE' },
      select: { status: true, accountEmail: true, connectedAt: true, lastCheckedAt: true, error: true },
    }),
    prisma.integrationConnection.findMany({
      where: { organizationId, provider: 'GMAIL' },
      select: { id: true, status: true, accountEmail: true, connectedAt: true, lastCheckedAt: true, error: true, settings: true },
      orderBy: { connectedAt: 'desc' },
    }),
  ]);
  const query = await searchParams;
  const result = query.google;
  const reason = query.reason;
  const configured = isGoogleOAuthConfigured();

  const gmailConnections: GmailConnectionItem[] = gmailConnectionsRaw.map((c) => ({
    id: c.id,
    accountEmail: c.accountEmail,
    status: c.status,
    connectedAt: c.connectedAt?.toISOString() ?? null,
    lastCheckedAt: c.lastCheckedAt?.toISOString() ?? null,
    error: c.error,
    settings: (c.settings as GmailConnectionItem['settings']) || null,
  }));

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrace</h1>
        <p className="mt-2 text-slate-600">Externí účty jsou oddělené pro každou organizaci. Přístupové tokeny se neposílají do prohlížeče.</p>
      </div>
      {result === 'connected' && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Google účet byl bezpečně připojen.</p>}
      {result === 'cancelled' && <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Připojení bylo zrušeno.</p>}
      {result === 'error' && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">
          <p>Google účet se nepodařilo připojit. Zkuste to znovu nebo zkontrolujte konfiguraci OAuth.</p>
          {reason && <p className="mt-1 text-xs font-mono font-normal text-red-700">Důvod: {reason}</p>}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <GmailIntegrationCard
          configured={configured}
          connections={gmailConnections}
        />
        <GoogleIntegrationCard
          configured={configured}
          connection={driveConnection ? {
            ...driveConnection,
            connectedAt: driveConnection.connectedAt?.toISOString() ?? null,
            lastCheckedAt: driveConnection.lastCheckedAt?.toISOString() ?? null,
          } : null}
        />
      </div>
    </AppShell>
  );
}
