import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import {
  buildRealizationContext,
  determineRealizationNextBestActions,
} from '@/lib/ai-realization/realization-engine';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  MapPin,
  Camera,
  Printer,
  ShieldAlert,
  Calendar,
  User,
  Wrench,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const PIPELINE_PHASES = [
  { key: 'PREPARATION', label: '1. Příprava' },
  { key: 'GRAPHICS', label: '2. Grafika' },
  { key: 'PRODUCTION', label: '3. Výroba' },
  { key: 'INSTALLATION', label: '4. Montáž' },
  { key: 'PHOTO_DOCUMENTATION', label: '5. Foto' },
  { key: 'READY_FOR_BILLING', label: '6. K fakturaci' },
  { key: 'INVOICED', label: '7. Fakturováno' },
  { key: 'COMPLETED', label: '8. Hotovo' },
] as const;

export default async function RealizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess('work');
  const { id } = await params;
  const organizationId = user.organizationId!;
  const profile = await getOrganizationRealizationProfile(organizationId);

  const context = await buildRealizationContext(id, user, profile);
  if (!context) notFound();

  const nextBestActions = determineRealizationNextBestActions(context);
  const primaryNba = nextBestActions[0];

  const currentPhaseIndex = PIPELINE_PHASES.findIndex((p) => p.key === context.overallPhase);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 pb-16">
        {/* Back Link & Header */}
        <div className="flex flex-col gap-3">
          <div>
            <Link
              href="/realization"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zpět na přehled realizací
            </Link>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-700">
                  {context.orderNumber}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {context.projectType}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {context.clientName}
              </h1>
              <p className="text-sm text-slate-500">
                {context.offerTitle ? `Z nabídky: ${context.offerTitle}` : 'Realizační zakázka'}
                {context.offerAcceptedAt && ` · Schváleno: ${new Date(context.offerAcceptedAt).toLocaleDateString('cs-CZ')}`}
                {context.offerAcceptedBy && ` (${context.offerAcceptedBy})`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {context.billingReadiness.isReady ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Připraveno k fakturaci
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Realizace probíhá
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 8-Phase Pipeline Progress Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fáze realizace zakázky
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {PIPELINE_PHASES.map((phase, idx) => {
              const isPast = currentPhaseIndex > idx;
              const isCurrent = currentPhaseIndex === idx;

              let style = 'border-slate-200 bg-slate-50 text-slate-400';
              if (isPast) {
                style = 'border-emerald-200 bg-emerald-50/70 text-emerald-700 font-medium';
              } else if (isCurrent) {
                style = 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-2 ring-sky-200';
              }

              return (
                <div
                  key={phase.key}
                  className={`flex items-center justify-center rounded-lg border py-2 px-2 text-center text-xs ${style}`}
                >
                  {isPast && <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />}
                  {phase.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Best Action Callout */}
        {primaryNba && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  <span>Doporučený další krok (Next Best Action)</span>
                  <span className="rounded bg-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900">
                    {primaryNba.priority}
                  </span>
                </div>
                <div className="text-base font-bold text-indigo-950">{primaryNba.title}</div>
                <p className="text-xs text-indigo-800">{primaryNba.description}</p>
              </div>

              {primaryNba.targetUrl && (
                <div>
                  <Link
                    href={primaryNba.targetUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-700"
                  >
                    Provést akci
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blockers & Deadline Risks */}
        {context.blockers.length > 0 && (
          <div className="space-y-2">
            {context.blockers.map((blocker, idx) => {
              const isBlocking = blocker.severity === 'BLOCKING';
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    isBlocking
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      isBlocking ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{blocker.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isBlocking ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {blocker.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-xs opacity-90">{blocker.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Realization Items / Surfaces Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Položky k realizaci ({context.items.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {context.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {item.surfaceName || item.carrierCode || 'Plocha'}
                    </span>
                    {item.carrierCode && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                        {item.carrierCode}
                      </span>
                    )}
                    {item.mediaType && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {item.mediaType}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {(item.carrierCity || item.carrierAddress) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.carrierCity} {item.carrierAddress}
                      </span>
                    )}
                    {item.plannedDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Plán: {new Date(item.plannedDate).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                  </div>

                  {item.hasDefect && (
                    <div className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {item.defectReason || 'Technický defekt'}
                    </div>
                  )}
                </div>

                {/* Status & Photo Thumbnail */}
                <div className="flex items-center gap-4">
                  {/* Installation Status */}
                  <div>
                    {item.isInstalled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Nainstalováno
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        Čeká na montáž
                      </span>
                    )}
                  </div>

                  {/* Photo Documentation Status */}
                  <div>
                    {item.isPhotographed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                        <Camera className="h-3.5 w-3.5" />
                        Fotodokumentace OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <Camera className="h-3.5 w-3.5" />
                        Chybí foto
                      </span>
                    )}
                  </div>

                  {/* Photo Thumbnail if present */}
                  {item.photos?.[0]?.url && (
                    <a
                      href={item.photos[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative h-10 w-10 overflow-hidden rounded-lg border border-slate-200"
                    >
                      <img
                        src={item.photos[0].url}
                        alt="Foto instalace"
                        className="h-full w-full object-cover transition group-hover:scale-110"
                      />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Print Jobs & Production */}
        {context.printJobs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Tisk a výroba materiálů ({context.printJobs.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {context.printJobs.map((pj) => (
                <div
                  key={pj.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Printer className="h-4 w-4 text-slate-400" />
                      {pj.title}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {pj.materialType || 'Materiál'}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {pj.quantity} ks
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {pj.artworkUrl ? 'Tisková data nahrána' : 'Chybí tisková data'}
                      {pj.isApproved && ` · Schváleno: ${new Date(pj.approvedAt!).toLocaleDateString('cs-CZ')}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        pj.status === 'DELIVERED_TO_WAREHOUSE'
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : pj.isApproved
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {pj.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
