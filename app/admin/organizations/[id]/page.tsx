import { AppShell } from '@/components/AppShell';
import { platformPrisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/organization';
import { notFound } from 'next/navigation';
import { OrganizationStatusButton } from '@/components/OrganizationStatusButton';
import { OrganizationModulesCard } from '@/components/OrganizationModulesCard';
import { getOrganizationFullUsageReport } from '@/lib/organization-usage';
import Link from 'next/link';

export default async function OrganizationAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    notFound();
  }

  const { id } = await params;
  const organization = await platformPrisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { name: true, email: true, status: true },
          },
        },
      },
    },
  });

  if (!organization) notFound();

  const [clients, surfaces, offers, fullUsage] = await Promise.all([
    platformPrisma.client.count({ where: { organizationId: id } }),
    platformPrisma.advertisingSurface.count({ where: { organizationId: id } }),
    platformPrisma.offer.count({ where: { organizationId: id } }),
    getOrganizationFullUsageReport(id),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <Link href="/admin/organizations" className="text-xs font-bold text-sky-700 hover:underline">
              ← Zpět na přehled firem
            </Link>
            <h1 className="text-3xl font-black text-slate-900 mt-1">{organization.name}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {organization.slug} · Tarif: <span className="font-bold text-purple-700">{organization.plan}</span> ·{' '}
              {organization.isActive ? (
                <span className="text-emerald-600 font-bold">Aktivní SaaS firma</span>
              ) : (
                <span className="text-rose-600 font-bold">Deaktivováno</span>
              )}
            </p>
          </div>
          <OrganizationStatusButton id={organization.id} isActive={organization.isActive} />
        </div>

        {/* System & Resource Metric Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Klienti</span>
            <strong className="text-2xl font-black text-slate-900 block">{clients}</strong>
          </div>

          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Reklamní plochy</span>
            <strong className="text-2xl font-black text-slate-900 block">{surfaces}</strong>
          </div>

          <div className="card border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Nabídky</span>
            <strong className="text-2xl font-black text-slate-900 block">{offers}</strong>
          </div>

          {/* Infrastructure Cost Summary Box */}
          <div className="card border-emerald-300 bg-emerald-50/50">
            <span className="text-xs font-bold text-emerald-800 uppercase">💰 Měsíční Náklady Služeb</span>
            <strong className="text-2xl font-black text-emerald-900 block">
              ~ {fullUsage.totalEstimatedCostCzk} Kč
            </strong>
            <span className="text-[11px] text-emerald-700 font-semibold block">AI + Maps + Cloud Uložiště</span>
          </div>
        </div>

        {/* Multi-resource Usage Breakdown Box */}
        <div className="card border-purple-200 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-3">
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">
                📊 Měřené API Služby & Uložiště za Tento Měsíc
              </h2>
              <p className="text-xs text-purple-300">Přehled vyčerpaných kapacit od 1. dne v měsíci</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-900 text-purple-200 border border-purple-700">
              Platformní billing
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Resource 1: AI Engine */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-800/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300">🤖 AI Engine (Gemini)</span>
                <span className="text-[10px] font-bold text-purple-400">~ {fullUsage.aiCostCzk} Kč</span>
              </div>
              <div className="text-xl font-black text-white">{fullUsage.aiCalls} dotazů</div>
              <div className="text-[11px] text-slate-400 font-mono">
                {(fullUsage.aiTokens / 1000).toFixed(1)}k tokenů (${fullUsage.aiCostUsd.toFixed(3)})
              </div>
            </div>

            {/* Resource 2: Google Maps API */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-800/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-300">🗺️ Google Maps API</span>
                <span className="text-[10px] font-bold text-sky-400">~ {fullUsage.googleMapsCostCzk} Kč</span>
              </div>
              <div className="text-xl font-black text-white">{fullUsage.googleMapsMapLoads} načtení</div>
              <div className="text-[11px] text-slate-400 font-mono">
                {fullUsage.googleMapsGeocodes} geokódování adres (${fullUsage.googleMapsCostUsd.toFixed(3)})
              </div>
            </div>

            {/* Resource 3: Cloud Storage */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-800/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300">☁️ Cloud Uložiště & Fotky</span>
                <span className="text-[10px] font-bold text-emerald-400">~ {fullUsage.storageCostCzk} Kč</span>
              </div>
              <div className="text-xl font-black text-white">{fullUsage.estimatedStorageGb} GB dat</div>
              <div className="text-[11px] text-slate-400 font-mono">
                {fullUsage.totalPhotosCount} nově nahraných fotek z terénu
              </div>
            </div>
          </div>
        </div>

        {/* Active Modules & Features Management Card */}
        <OrganizationModulesCard
          organizationId={organization.id}
          initialPlan={organization.plan}
          initialEnabledModules={organization.enabledModules}
        />

        {/* Members List */}
        <div className="card">
          <h2 className="text-xl font-bold">Členové organizace</h2>
          <ul className="mt-3 divide-y">
            {organization.members.map((member) => (
              <li className="py-3 flex items-center justify-between" key={member.id}>
                <div>
                  <span className="font-bold text-slate-900">{member.user.name}</span>
                  <span className="text-xs text-slate-500 block">{member.user.email}</span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {member.role}
                  </span>
                  <span
                    className={`ml-2 text-xs font-bold ${member.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {member.isActive ? 'Aktivní' : 'Neaktivní'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
