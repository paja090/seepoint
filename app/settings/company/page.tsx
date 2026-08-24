import { AppShell } from '@/components/AppShell';
import { CompanySettingsForm } from '@/components/CompanySettingsForm';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { getOrganizationFullUsageReport } from '@/lib/organization-usage';
import { notFound } from 'next/navigation';

export default async function CompanySettingsPage() {
  const { organizationId } = await requireOrganizationRole('ADMIN');
  const organization = await platformPrisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) notFound();

  const fullUsage = await getOrganizationFullUsageReport(organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold">Nastavení firmy & Měření Služeb</h1>
          <p className="mt-1 text-slate-600">Fakturační údaje, branding a měsíční spotřeba systémových zdrojů v SeePoint OS.</p>
        </div>

        {/* Full Resource Usage Widget for Company Admins */}
        <div className="card border-purple-200 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>📊 Měřené Zdroje & Služby Tento Měsíc (AI, Google Maps, Uložiště)</span>
              </h2>
              <p className="text-xs text-purple-300">Přehled vyčerpaných kapacit od 1. v měsíci</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-900 text-purple-200 border border-purple-700">
              Odhad: ~ {fullUsage.totalEstimatedCostCzk} Kč / měs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Resource 1: AI Engine */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-800/60 space-y-1">
              <div className="flex items-center justify-between font-bold text-purple-300">
                <span>🤖 AI Engine (Gemini)</span>
                <span>~ {fullUsage.aiCostCzk} Kč</span>
              </div>
              <strong className="text-lg font-black text-white block">{fullUsage.aiCalls} generování</strong>
              <span className="text-[10px] text-slate-400 font-mono">
                {(fullUsage.aiTokens / 1000).toFixed(1)}k tokenů (${fullUsage.aiCostUsd.toFixed(3)})
              </span>
            </div>

            {/* Resource 2: Google Maps API */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-sky-800/60 space-y-1">
              <div className="flex items-center justify-between font-bold text-sky-300">
                <span>🗺️ Google Maps API</span>
                <span>~ {fullUsage.googleMapsCostCzk} Kč</span>
              </div>
              <strong className="text-lg font-black text-white block">{fullUsage.googleMapsMapLoads} načtení</strong>
              <span className="text-[10px] text-slate-400 font-mono">
                {fullUsage.googleMapsGeocodes} geokódování (${fullUsage.googleMapsCostUsd.toFixed(3)})
              </span>
            </div>

            {/* Resource 3: Cloud Storage */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-800/60 space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-300">
                <span>☁️ Uložiště Fotek</span>
                <span>~ {fullUsage.storageCostCzk} Kč</span>
              </div>
              <strong className="text-lg font-black text-white block">{fullUsage.estimatedStorageGb} GB dat</strong>
              <span className="text-[10px] text-slate-400 font-mono">
                {fullUsage.totalPhotosCount} nahraných fotek v terénu
              </span>
            </div>
          </div>
        </div>

        <CompanySettingsForm
          organization={
            Object.fromEntries(
              Object.entries(organization).map(([key, value]) => [
                key,
                value instanceof Date ? value.toISOString() : value,
              ])
            ) as Record<string, string | null>
          }
        />
      </div>
    </AppShell>
  );
}
