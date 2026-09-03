import { AppShell } from '@/components/AppShell';
import { GoogleIntegrationCard } from '@/components/GoogleIntegrationCard';
import { prisma } from '@/lib/db';
import { isGoogleOAuthConfigured } from '@/lib/integrations/google-oauth';
import { requireOrganizationRole } from '@/lib/organization';

export default async function IntegrationsSettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await requireOrganizationRole('ADMIN');
  const connection = await prisma.integrationConnection.findFirst({
    where: { provider: 'GOOGLE_DRIVE' },
    select: { status: true, accountEmail: true, connectedAt: true, lastCheckedAt: true, error: true },
  });
  const result = (await searchParams).google;
  const configured = isGoogleOAuthConfigured();
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrace</h1>
        <p className="mt-2 text-slate-600">Externí účty jsou oddělené pro každou organizaci. Přístupové tokeny se neposílají do prohlížeče.</p>
      </div>
      {result === 'connected' && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Google účet byl bezpečně připojen.</p>}
      {result === 'cancelled' && <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Připojení bylo zrušeno.</p>}
      {result === 'error' && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">Google účet se nepodařilo připojit. Zkuste to znovu nebo zkontrolujte konfiguraci OAuth.</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <GoogleIntegrationCard
          configured={configured}
          connection={connection ? {
            ...connection,
            connectedAt: connection.connectedAt?.toISOString() ?? null,
            lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
          } : null}
        />
        <section className="card space-y-3 opacity-75">
          <h2 className="text-xl font-bold">Gmail a Google Workspace</h2>
          <p className="text-sm text-slate-600">Připraveno v datovém modelu. Oprávnění pro odesílání e-mailů přidáme samostatně, aby Drive nevyžadoval zbytečně široký přístup.</p>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Připravujeme</span>
        </section>
      </div>
    </AppShell>
  );
}
