import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import { buildRealizationContext } from '@/lib/ai-realization/realization-engine';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  Camera,
  Layers,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RealizationDashboardPage() {
  const user = await requirePageAccess('work');
  const organizationId = user.organizationId!;
  const profile = await getOrganizationRealizationProfile(organizationId);

  const orders = await prisma.crmOrder.findMany({
    where: {
      organizationId,
      status: { notIn: ['CANCELLED'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const contexts = (
    await Promise.all(
      orders.map((o) => buildRealizationContext(o.id, user, profile))
    )
  ).filter(Boolean);

  let totalActive = 0;
  let atRiskCount = 0;
  let blockedCount = 0;
  let missingPhotosCount = 0;
  let readyForBillingCount = 0;

  for (const ctx of contexts) {
    const isCompleted = ctx!.status === 'COMPLETED' || ctx!.overallPhase === 'COMPLETED';
    if (!isCompleted) totalActive++;
    if (ctx!.deadlineRisk.isAtRisk) atRiskCount++;
    if (ctx!.blockers.some((b) => b.severity === 'BLOCKING')) blockedCount++;
    if (ctx!.items.some((i) => !i.isPhotographed && i.isInstalled)) missingPhotosCount++;
    if (ctx!.billingReadiness.isReady) readyForBillingCount++;
  }

  const phaseColors: Record<string, string> = {
    PREPARATION: 'bg-slate-100 text-slate-800 border-slate-200',
    GRAPHICS: 'bg-amber-50 text-amber-800 border-amber-200',
    PRODUCTION: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    INSTALLATION: 'bg-blue-50 text-blue-800 border-blue-200',
    PHOTO_DOCUMENTATION: 'bg-purple-50 text-purple-800 border-purple-200',
    READY_FOR_BILLING: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    INVOICED: 'bg-teal-50 text-teal-800 border-teal-200',
    COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const phaseLabels: Record<string, string> = {
    PREPARATION: 'Příprava zakázky',
    GRAPHICS: 'Grafické podklady',
    PRODUCTION: 'Výroba / tisk',
    INSTALLATION: 'Probíhá montáž',
    PHOTO_DOCUMENTATION: 'Čeká na fotografie',
    READY_FOR_BILLING: 'Připraveno k fakturaci',
    INVOICED: 'Vyfakturováno',
    COMPLETED: 'Dokončeno',
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Realization Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Inteligentní řízení a kontrola realizace zakázek po schválení nabídky
            </p>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Layers className="h-4 w-4 text-slate-400" />
              Aktivní zakázky
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalActive}</div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-700">
              <Clock className="h-4 w-4 text-amber-500" />
              Ohrožené termíny
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">{atRiskCount}</div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-rose-700">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Blokované
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-900">{blockedCount}</div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-purple-700">
              <Camera className="h-4 w-4 text-purple-500" />
              Chybí fotodokumentace
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-900">{missingPhotosCount}</div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-700">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              K fakturaci
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">{readyForBillingCount}</div>
          </div>
        </div>

        {/* Realization List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">Přehled realizovaných zakázek</h2>
          </div>

          {contexts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              Nebyly nalezeny žádné aktivní realizační zakázky.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {contexts.map((ctx) => {
                const totalItems = ctx!.items.length;
                const installedItems = ctx!.items.filter((i) => i.isInstalled).length;
                const photographedItems = ctx!.items.filter((i) => i.isPhotographed).length;
                const hasBlockers = ctx!.blockers.some((b) => b.severity === 'BLOCKING');
                const isAtRisk = ctx!.deadlineRisk.isAtRisk;

                return (
                  <div
                    key={ctx!.orderId}
                    className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1.5 sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-600">
                          {ctx!.orderNumber}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            phaseColors[ctx!.overallPhase] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {phaseLabels[ctx!.overallPhase] || ctx!.overallPhase}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          {ctx!.projectType}
                        </span>
                      </div>

                      <div className="text-base font-medium text-slate-900">
                        {ctx!.clientName}
                      </div>

                      <div className="text-xs text-slate-500">
                        {ctx!.campaign.dateFrom
                          ? `${ctx!.campaign.dateFrom.toISOString().slice(0, 10)} až ${ctx!.campaign.dateTo?.toISOString().slice(0, 10) || 'neurčeno'}`
                          : 'Termín nestanoven'}
                        {ctx!.offerTitle && ` · Nabídka: ${ctx!.offerTitle}`}
                      </div>
                    </div>

                    {/* Progress Stats */}
                    <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {installedItems} / {totalItems}
                        </div>
                        <div className="text-slate-400">Instalováno</div>
                      </div>

                      <div>
                        <div className="font-semibold text-slate-900">
                          {photographedItems} / {totalItems}
                        </div>
                        <div className="text-slate-400">Fotografie</div>
                      </div>

                      {/* Warnings / Blockers Badge */}
                      {hasBlockers && (
                        <div className="flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {ctx!.blockers.length} blokací
                        </div>
                      )}

                      {isAtRisk && !hasBlockers && (
                        <div className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                          Termínové riziko
                        </div>
                      )}

                      {ctx!.billingReadiness.isReady && (
                        <div className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Připraveno k fakturaci
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div>
                      <Link
                        href={`/realization/${ctx!.orderId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        Detail realizace
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
