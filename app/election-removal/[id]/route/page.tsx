import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { MobileRouteExecutionView } from '@/components/election-removal/MobileRouteExecutionView';
import { ArrowLeft, Route } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ElectionRemovalRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ crew?: string; planId?: string }>;
}) {
  const user = await checkElectionRemovalPageAccess();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCrewId = resolvedSearchParams?.crew;

  const [campaign, employees, vehicles] = await Promise.all([
    prisma.electionCampaign.findFirst({
      where: {
        id,
        organizationId: user.organization!.id,
      },
      include: {
        points: {
          include: {
            photos: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: [
            { plannedOrder: 'asc' },
            { layerName: 'asc' },
            { label: 'asc' },
          ],
        },
        fieldPlans: {
          where: { organizationId: user.organization!.id },
          select: {
            id: true,
            date: true,
            version: true,
            status: true,
            planningSummary: true,
          },
          orderBy: { version: 'desc' },
        },
      },
    }),
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

  if (!campaign) {
    notFound();
  }

  const employeeMap = new Map(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()])
  );
  const vehicleMap = new Map(
    vehicles.map((v) => [
      v.id,
      v.registrationNumber ? `${v.name} (${v.registrationNumber})` : v.name,
    ])
  );

  const selectedPlanId = resolvedSearchParams?.planId;
  const currentPlan = selectedPlanId
    ? campaign.fieldPlans.find((p) => p.id === selectedPlanId) || campaign.fieldPlans[0]
    : campaign.fieldPlans[0];

  const planPointIds = new Set<string>();
  const currentSummary = currentPlan?.planningSummary as {
    crews?: Array<{
      id: string;
      employeeIds?: string[];
      names?: string[];
      vehicleId?: string | null;
      vehicleName?: string | null;
      stops?: Array<{ electionRemovalPointId?: string }>;
    }>;
  } | null;

  if (currentSummary?.crews) {
    for (const c of currentSummary.crews) {
      if (c.stops) {
        for (const s of c.stops) {
          if (s.electionRemovalPointId) {
            planPointIds.add(s.electionRemovalPointId);
          }
        }
      }
    }
  }

  // Filter points: only include points that belong to this approved plan
  const planPoints = currentPlan && planPointIds.size > 0
    ? campaign.points.filter((p) => planPointIds.has(p.id) || p.assignedFieldPlanId === currentPlan.id)
    : campaign.points;

  const crewMembersMap: Record<
    string,
    {
      employeeIds: string[];
      names: string[];
      vehicleId: string | null;
      vehicleName: string | null;
    }
  > = {};

  if (currentSummary?.crews) {
    for (const c of currentSummary.crews) {
      const empIds = c.employeeIds || [];
      const names =
        c.names && c.names.length > 0
          ? c.names
          : empIds.map((id) => employeeMap.get(id) || id);
      const vId = c.vehicleId || null;
      const vName = c.vehicleName || (vId ? vehicleMap.get(vId) || null : null);
      crewMembersMap[c.id] = {
        employeeIds: empIds,
        names,
        vehicleId: vId,
        vehicleName: vName,
      };
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <Link
            href={`/election-removal/${campaign.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zpět na přehled kampaně</span>
          </Link>
        </div>

        {currentPlan && (
          <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm">
                  Schválená trasa pro výjezd ({currentPlan.date})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-200 text-sky-900">
                  {currentPlan.status}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  v{currentPlan.version}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Obsahuje <strong>{planPoints.length}</strong> vybraných stanovišť k realizaci.
              </p>
            </div>

            {campaign.fieldPlans.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">Další trasy:</span>
                <div className="flex flex-wrap gap-1">
                  {campaign.fieldPlans.map((fp) => (
                    <Link
                      key={fp.id}
                      href={`/election-removal/${campaign.id}/route?planId=${fp.id}`}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                        fp.id === currentPlan.id
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {fp.date}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <MobileRouteExecutionView
          campaign={campaign}
          points={planPoints}
          initialCrewId={initialCrewId}
          crewMembersMap={crewMembersMap}
          employees={employees.map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
            role: e.role,
            position: e.position,
          }))}
          vehicles={vehicles}
          canManageCrew={['ADMIN', 'MANAGER', 'TECHNICIAN'].includes(user.role)}
        />
      </div>
    </AppShell>
  );
}
