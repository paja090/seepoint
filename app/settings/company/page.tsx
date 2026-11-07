import { AppShell } from '@/components/AppShell';
import { CompanySettingsForm } from '@/components/CompanySettingsForm';
import { platformPrisma, prisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { getOrganizationFullUsageReport } from '@/lib/organization-usage';
import { evaluateSubscriptionState } from '@/lib/subscription';
import { notFound } from 'next/navigation';

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeZone: 'Europe/Prague' });

export default async function CompanySettingsPage() {
  const { organizationId } = await requireOrganizationRole('ADMIN');
  const [organization, fullUsage, surfaceCount] = await Promise.all([
    platformPrisma.organization.findUnique({
      where: { id: organizationId },
      include: { _count: { select: { members: { where: { isActive: true } } } } },
    }),
    getOrganizationFullUsageReport(organizationId),
    prisma.advertisingSurface.count(),
  ]);
  if (!organization) notFound();

  const subscription = evaluateSubscriptionState(organization);
  const activeMembersCount = organization._count.members;
  const surfaceLimit = subscription.plan.surfaceLimit;
  const userLimit = subscription.plan.userLimit;
  const surfaceOverLimit = surfaceLimit !== null && surfaceCount > surfaceLimit;
  const userOverLimit = userLimit !== null && activeMembersCount > userLimit;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="mb-2">
          <h1 className="text-3xl font-bold">Nastavení firmy, loga a kontaktů</h1>
          <p className="mt-1 text-slate-600">Nahrajte své firemní logo, doplňte telefon a e-mail pro klientské nabídky a zkontrolujte fakturační údaje.</p>
        </div>

        <CompanySettingsForm
          organization={
            Object.fromEntries(
              Object.entries(organization).map(([key, value]) => [
                key,
                value instanceof Date ? value.toISOString() : typeof value === 'object' && value !== null ? String(value) : value,
              ])
            ) as Record<string, string | number | null>
          }
        />

        {/* Subscription & Soft Limits Overview Card */}
        <div className="card border-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Aktuální tarif</span>
                <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-black text-purple-800">
                  {subscription.plan.label}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    subscription.status === 'ACTIVE' || subscription.status === 'INTERNAL'
                      ? 'bg-emerald-100 text-emerald-800'
                      : subscription.status === 'TRIAL' && !subscription.isTrialExpired
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {subscription.statusLabel}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {subscription.plan.monthlyPriceCzk
                  ? `Ceníková cena: ${subscription.plan.monthlyPriceCzk.toLocaleString('cs-CZ')} Kč / měsíc (nebo ${subscription.plan.annualPriceCzk?.toLocaleString('cs-CZ')} Kč / rok – 2 měsíce zdarma)`
                  : 'Individuální nebo interní licenční režim'}
                {subscription.status === 'TRIAL' && organization.trialEndsAt
                  ? ` · Zkušební období do ${dateFormatter.format(organization.trialEndsAt)}`
                  : ''}
              </p>
            </div>
            <a
              href="mailto:info@seepoint.cz?subject=Zm%C4%9Bna%20tarifu%20nebo%20fakturace%20SeePoint%20OS"
              className="btn-secondary text-xs"
            >
              Požádat o změnu tarifu / fakturu
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div
              className={`rounded-2xl border p-4 ${
                surfaceOverLimit ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>🗺️ Evidované reklamní plochy</span>
                <span className={surfaceOverLimit ? 'text-amber-800' : 'text-slate-900'}>
                  {surfaceCount} / {surfaceLimit ?? '∞'}
                </span>
              </div>
              {surfaceOverLimit ? (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-800">
                  Překročili jste doporučený limit tarifu {subscription.plan.label} ({surfaceLimit} nosičů). Doporučujeme přechod na vyšší tarif.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  Kapacita nosičů v rámci vašeho tarifu {subscription.plan.label}.
                </p>
              )}
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                userOverLimit ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>👥 Aktivní uživatelé v týmu</span>
                <span className={userOverLimit ? 'text-amber-800' : 'text-slate-900'}>
                  {activeMembersCount} / {userLimit ?? '∞'}
                </span>
              </div>
              {userOverLimit ? (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-800">
                  Překročili jste doporučený počet uživatelů tarifu {subscription.plan.label} ({userLimit} uživatelů). Doporučujeme přechod na vyšší tarif.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  Počet aktivních členů organizace s přístupem do systému.
                </p>
              )}
            </div>
          </div>
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
      </div>
    </AppShell>
  );
}
