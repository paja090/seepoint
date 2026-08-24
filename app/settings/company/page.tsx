import { AppShell } from '@/components/AppShell';
import { CompanySettingsForm } from '@/components/CompanySettingsForm';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { getOrganizationAIUsage } from '@/lib/ai-usage';
import { notFound } from 'next/navigation';

export default async function CompanySettingsPage() {
  const { organizationId } = await requireOrganizationRole('ADMIN');
  const organization = await platformPrisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) notFound();

  const aiUsage = await getOrganizationAIUsage(organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold">Nastavení firmy & AI Spotřeby</h1>
          <p className="mt-1 text-slate-600">Fakturační údaje, branding a měsíční spotřeba AI kreditů v SeePoint OS.</p>
        </div>

        {/* AI Usage Widget for Org Admins */}
        <div className="card border-purple-200 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-purple-800/80 pb-3">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>🤖 SeePoint AI Engine — Spotřeba kreditů tento měsíc</span>
            </h2>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-950 text-purple-200 border border-purple-700">
              Měsíční přehled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Počet AI Operací</span>
              <strong className="text-lg font-black text-white">{aiUsage.totalCalls} generování</strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Spotřebované Tokeny</span>
              <strong className="text-lg font-black text-purple-300">
                {((aiUsage.totalPromptTokens + aiUsage.totalOutputTokens) / 1000).toFixed(1)}k tokenů
              </strong>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-800/60">
              <span className="text-slate-400 block font-semibold">Odhadované náklady na AI API</span>
              <strong className="text-lg font-black text-emerald-400">
                ~ {Math.round((aiUsage.totalCostUsd || 0) * 23.5)} Kč (${aiUsage.totalCostUsd.toFixed(3)})
              </strong>
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
