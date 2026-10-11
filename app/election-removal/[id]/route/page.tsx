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
  searchParams?: Promise<{ crew?: string }>;
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

  const latestPlan = campaign.fieldPlans[0];
  const latestSummary = latestPlan?.planningSummary as {
    crews?: Array<{
      id: string;
      employeeIds?: string[];
      names?: string[];
      vehicleId?: string | null;
      vehicleName?: string | null;
    }>;
  } | null;

  const crewMembersMap: Record<
    string,
    {
      employeeIds: string[];
      names: string[];
      vehicleId: string | null;
      vehicleName: string | null;
    }
  > = {};

  if (latestSummary?.crews) {
    for (const c of latestSummary.crews) {
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

        <MobileRouteExecutionView
          campaign={campaign}
          points={campaign.points}
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
