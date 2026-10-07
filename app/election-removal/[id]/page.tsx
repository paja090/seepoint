import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { CampaignPointsView } from '@/components/election-removal/CampaignPointsView';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Route,
  Vote,
  Sparkles,
} from 'lucide-react';
import { DeleteCampaignButton } from '@/components/election-removal/DeleteCampaignButton';

export const dynamic = 'force-dynamic';

export default async function ElectionRemovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await checkElectionRemovalPageAccess();
  const { id } = await params;

  const campaign = await prisma.electionCampaign.findFirst({
    where: {
      id,
      organizationId: user.organization!.id,
    },
    include: {
      points: {
        orderBy: [{ layerName: 'asc' }, { label: 'asc' }],
      },
      fieldPlans: {
        select: {
          id: true,
          date: true,
          version: true,
          status: true,
          planningSummary: true,
        },
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  // Calculate statistics
  const totalPoints = campaign.points.length;
  const completedPoints = campaign.points.filter((p) => p.status === 'COMPLETED').length;
  const pendingPoints = campaign.points.filter((p) => p.status === 'PENDING').length;
  const totalServiceMinutes = campaign.points.reduce((acc, p) => acc + p.serviceMinutes, 0);

  const hours = Math.floor(totalServiceMinutes / 60);
  const mins = totalServiceMinutes % 60;
  const formattedWorkTime = `${hours} h ${mins} min`;

  const percentDone = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/election-removal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zpět na přehled kampaní</span>
          </Link>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl mt-1">
                <Vote className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {campaign.name}
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                    {campaign.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  {campaign.targetDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Termín: {new Date(campaign.targetDate).toLocaleDateString('cs-CZ')}
                    </span>
                  )}
                  {campaign.kmlFileName && (
                    <span>Zdroj KML: {campaign.kmlFileName}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/election-removal/${campaign.id}/route`}
                className="btn bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-sm font-semibold inline-flex items-center gap-2"
              >
                <Route className="w-4 h-4" />
                <span>📱 Trasa v terénu</span>
              </Link>

              <Link
                href={`/election-removal/${campaign.id}/plan`}
                className="btn btn-primary text-sm font-semibold inline-flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Plánovat trasy</span>
              </Link>

              <DeleteCampaignButton
                campaignId={campaign.id}
                campaignName={campaign.name}
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Celkem médií
              </p>
              <MapPin className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {totalPoints} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Fyzických nosičů v kampani
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Čeká na plánování
              </p>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              {pendingPoints} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Zatím nepřiřazeno do tras
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Hotovo
              </p>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {completedPoints} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {percentDone} % z celkového počtu
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Odhadovaný čas demontáže
              </p>
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {formattedWorkTime}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Čistý servisní čas (bez přejezdů)
            </p>
          </div>
        </div>

        {/* Field Plans / Routes section */}
        {campaign.fieldPlans.length > 0 && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Route className="w-5 h-5 text-sky-600" />
                Naplánované demontážní trasy ({campaign.fieldPlans.length})
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaign.fieldPlans.map((plan) => {
                const summary =
                  plan.planningSummary && typeof plan.planningSummary === 'object'
                    ? (plan.planningSummary as Record<string, unknown>)
                    : null;
                return (
                  <div
                    key={plan.id}
                    className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 text-sm">
                        Trasa {plan.date} (v{plan.version})
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Plánováno na datum: {plan.date}
                    </p>
                    {summary?.totalDistanceKm !== undefined && (
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs text-slate-500">
                        <span>{Number(summary.totalDistanceKm).toFixed(1)} km</span>
                        <span>{Number(summary.totalDurationMinutes || 0)} min</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Points Table Component */}
        <CampaignPointsView points={campaign.points} />
      </div>
    </AppShell>
  );
}
