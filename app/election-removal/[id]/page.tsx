import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { CampaignPointsView } from '@/components/election-removal/CampaignPointsView';
import { CampaignCrewsManager } from '@/components/election-removal/CampaignCrewsManager';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Route,
  Truck,
  Sparkles,
} from 'lucide-react';
import { DeleteCampaignButton } from '@/components/election-removal/DeleteCampaignButton';
import { CampaignTelemetryCard } from '@/components/election-removal/CampaignTelemetryCard';
import { analyzeCampaignTelemetry } from '@/lib/election-removal/ai-telemetry';

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
  const totalPoints = campaign.points.reduce((sum, p) => sum + p.quantity, 0);
  const completedPoints = campaign.points.filter((p) => p.status === 'COMPLETED').reduce((sum, p) => sum + p.quantity, 0);
  const remainingPoints = totalPoints - completedPoints;
  const unassignedPoints = campaign.points.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.quantity, 0);
  const totalServiceMinutes = campaign.points
    .filter((p) => p.status !== 'COMPLETED')
    .reduce((acc, p) => acc + p.serviceMinutes, 0);

  const hours = Math.floor(totalServiceMinutes / 60);
  const mins = totalServiceMinutes % 60;
  const formattedWorkTime = `${hours} h ${mins} min`;

  const percentDone = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  const distinctCrews = Array.from(
    new Set(campaign.points.map((p) => p.assignedCrewId).filter(Boolean) as string[])
  ).sort();

  const [employees, vehicles] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: user.organization!.id, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true, position: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.vehicle.findMany({
      where: {
        organizationId: user.organization!.id,
        status: { notIn: ['SERVICE', 'OUT_OF_SERVICE'] },
      },
      select: { id: true, name: true, registrationNumber: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const employeeMap = new Map(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()])
  );
  const vehicleMap = new Map(
    vehicles.map((v) => [
      v.id,
      v.registrationNumber ? `${v.name} (${v.registrationNumber})` : v.name,
    ])
  );

  const latestPlan = campaign.fieldPlans[campaign.fieldPlans.length - 1];
  const latestSummary = latestPlan?.planningSummary as {
    crews?: Array<{
      id: string;
      employeeIds?: string[];
      names?: string[];
      vehicleId?: string | null;
      vehicleName?: string | null;
    }>;
  } | null;

  const crewsData = distinctCrews.map((crewId) => {
    const crewPoints = campaign.points.filter((p) => p.assignedCrewId === crewId);
    const crewCompleted = crewPoints
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.quantity, 0);
    const crewTotal = crewPoints.reduce((sum, p) => sum + p.quantity, 0);

    const plannedCrew = latestSummary?.crews?.find((c) => c.id === crewId);
    const employeeIds = plannedCrew?.employeeIds || [];
    const names =
      plannedCrew?.names && plannedCrew.names.length > 0
        ? plannedCrew.names
        : employeeIds.map((id) => employeeMap.get(id) || id);

    const vehicleId = plannedCrew?.vehicleId || null;
    const vehicleName =
      plannedCrew?.vehicleName ||
      (vehicleId ? vehicleMap.get(vehicleId) || null : null);

    return {
      id: crewId,
      name: crewId.replace('crew-', 'Posádka '),
      employeeIds,
      names,
      vehicleId,
      vehicleName,
      totalPoints: crewTotal,
      completedPoints: crewCompleted,
    };
  });

  const telemetryReport = analyzeCampaignTelemetry(campaign.points);

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
            <span>Zpět na přehled přesunů a deinstalací</span>
          </Link>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl mt-1">
                <Truck className="w-6 h-6" />
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

              {(user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'TECHNICIAN') && (
                <Link
                  href={`/election-removal/${campaign.id}/plan`}
                  className="btn btn-primary text-sm font-semibold inline-flex items-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {completedPoints > 0 && remainingPoints > 0
                      ? `Plánovat další výjezd (${remainingPoints} ks)`
                      : 'Plánovat trasy'}
                  </span>
                </Link>
              )}

              {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
                <DeleteCampaignButton
                  campaignId={campaign.id}
                  campaignName={campaign.name}
                />
              )}
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
                Zbývá k demontáži
              </p>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              {remainingPoints} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {unassignedPoints > 0
                ? `${unassignedPoints} ks zatím bez trasy`
                : `${completedPoints} hotovo z ${totalPoints}`}
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

        {/* Dispečink výjezdů pro posádky */}
        {distinctCrews.length > 0 && (
          <CampaignCrewsManager
            campaignId={campaign.id}
            initialCrews={crewsData}
            employees={employees.map((e) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`.trim(),
              role: e.role,
              position: e.position,
            }))}
            vehicles={vehicles}
            canManage={user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'TECHNICIAN'}
          />
        )}

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
                    {Array.isArray(summary?.crews) && (
                      <div className="pt-2 border-t border-slate-200/60 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Posádky:
                        </p>
                        <div className="space-y-1">
                          {(
                            summary.crews as Array<{
                              id: string;
                              names?: string[];
                              vehicleName?: string | null;
                            }>
                          ).map((c, i) => (
                            <div
                              key={c.id || i}
                              className="text-xs text-slate-700 flex items-start justify-between gap-1"
                            >
                              <span className="font-semibold text-slate-800">
                                {c.id.replace('crew-', 'Posádka ')}:{' '}
                                <span className="font-normal text-slate-600">
                                  {c.names && c.names.length > 0
                                    ? c.names.join(', ')
                                    : 'Bez pracovníků'}
                                </span>
                              </span>
                              {c.vehicleName && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {c.vehicleName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Telemetry & Calibration Report */}
        <CampaignTelemetryCard report={telemetryReport} />

        {/* Points Table Component */}
        <CampaignPointsView points={campaign.points} campaignId={campaign.id} />
      </div>
    </AppShell>
  );
}
