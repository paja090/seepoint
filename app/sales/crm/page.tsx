import Link from 'next/link';
import { ArrowUpRight, Building2, Plus, Search, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LogoPlaceholder } from '@/components/offer/LogoPlaceholder';
import { StatusPill } from '@/components/sales/ui';
import { Button, Card, PageHeader, StatCard } from '@/components/ui';
import { crmClients, formatCzk } from '@/lib/mock-sales-data';

export const metadata = { title: 'Klientské CRM | SeePOINT' };

const statusMeta = {
  active: { label: 'Aktivní', tone: 'emerald' as const },
  prospect: { label: 'Prospekt', tone: 'amber' as const },
  inactive: { label: 'Neaktivní', tone: 'slate' as const },
};

function healthTone(score: number) {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

export default function CrmListPage() {
  const totalRevenue = crmClients.reduce((sum, client) => sum + client.totalRevenue, 0);
  const openValue = crmClients.reduce((sum, client) => sum + client.openValue, 0);
  const activeCount = crmClients.filter((client) => client.status === 'active').length;

  return (
    <AppShell>
      <PageHeader
        title="Klientské CRM"
        description="Kompletní obchodní karta klienta – kontakty, komunikace, kampaně, poznámky a soubory na jednom místě."
        actions={
          <Button href="/sales/new">
            <Plus aria-hidden className="mr-1.5" size={16} />
            Nový návrh kampaně
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard description={`${crmClients.length} klientů v evidenci`} icon={<Building2 size={20} />} label="Aktivní klienti" tone="blue" value={activeCount} />
        <StatCard description="Celkový obrat (životní)" icon={<TrendingUp size={20} />} label="Obrat klientů" tone="green" value={formatCzk(totalRevenue)} />
        <StatCard description="Otevřené příležitosti" icon={<ArrowUpRight size={20} />} label="Otevřená hodnota" tone="purple" value={formatCzk(openValue)} />
      </div>

      <Card className="mb-6 !p-4">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          <Search aria-hidden className="mr-2 text-slate-400" size={16} />
          Hledat klienta podle názvu, oboru nebo kontaktu (ukázkové rozhraní)
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {crmClients.map((client) => {
          const status = statusMeta[client.status];
          const activeCampaigns = client.campaigns.filter((campaign) => campaign.status === 'active').length;
          return (
            <Link
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              href={`/sales/crm/${client.id}`}
              key={client.id}
            >
              <div className="flex items-start justify-between gap-3">
                <LogoPlaceholder label={client.logoLabel} size="sm" />
                <StatusPill label={status.label} tone={status.tone} />
              </div>
              <h3 className="mt-4 text-base font-semibold leading-tight text-slate-950">{client.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{client.industry} · klient od {client.since}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[11px] text-slate-400">Obrat</p>
                  <p className="text-sm font-semibold text-slate-900">{formatCzk(client.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Kampaně</p>
                  <p className="text-sm font-semibold text-slate-900">{activeCampaigns} aktivní</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Skóre</p>
                  <p className={`text-sm font-semibold ${healthTone(client.healthScore)}`}>{client.healthScore}</p>
                </div>
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 transition group-hover:text-sky-900">
                Otevřít kartu
                <ArrowUpRight aria-hidden size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
