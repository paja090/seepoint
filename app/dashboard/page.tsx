import { AppShell } from '@/components/AppShell';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { WorkerDashboard } from '@/components/dashboard/WorkerDashboard';
import { SalesDashboard } from '@/components/dashboard/SalesDashboard';
import { deriveAnalyticsSurfaceState } from '@/lib/analytics-finance';
import { derivedVehicleStatus } from '@/lib/vehicle-reservations';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await requirePageAccess('dashboard');
  const role = user.role;
  const isWorkerOrTech = role === 'WORKER' || role === 'TECHNICIAN';
  const isSales = role === 'SALES';

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  if (isWorkerOrTech) {
    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;
    const firstName = user.employee?.firstName
      ? user.employee.firstName
      : (user.name ? user.name.split(' ')[0] : 'Kolego');

    const [assignedTasks, completedEntries, vehicles] = await Promise.all([
      prisma.workAssignment.findMany({
        where: {
          OR: [
            { userId: user.id },
            { workerName: { contains: workerName, mode: 'insensitive' } },
          ],
          workOrder: { status: { notIn: ['DONE', 'CANCELLED'] } },
        },
        include: { workOrder: true },
        take: 10,
      }),
      prisma.workEntry.findMany({
        where: {
          employeeId: user.employee?.id || 'none',
          workDate: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
        },
      }),
      prisma.vehicleReservation.findFirst({
        where: {
          employeeId: user.employee?.id || 'none',
          status: { in: ['RESERVED', 'ACTIVE'] },
          dateTo: { gte: today },
        },
        include: { vehicle: true },
        orderBy: { dateFrom: 'asc' },
      }),
    ]);

    const upcomingTasks = assignedTasks.map((a) => ({
      id: a.workOrder.id,
      title: a.workOrder.title,
      clientName: a.workOrder.clientName,
      scheduledAt: a.workOrder.scheduledAt,
      status: a.workOrder.status,
      priority: a.workOrder.priority,
    }));

    const monthlyEarnings = completedEntries.reduce((acc, curr) => acc + (curr.calculatedAmount ? Number(curr.calculatedAmount) : 0), 0);

    return (
      <AppShell>
        <WorkerDashboard
          workerName={firstName}
          assignedTasksCount={assignedTasks.length}
          completedEntriesCount={completedEntries.length}
          monthlyEarnings={monthlyEarnings}
          assignedVehicle={vehicles?.vehicle ? {
            id: vehicles.vehicle.id,
            name: vehicles.vehicle.name,
            registrationNumber: vehicles.vehicle.registrationNumber,
            status: derivedVehicleStatus(vehicles.vehicle.status, [vehicles], today),
          } : null}
          upcomingTasks={upcomingTasks}
        />
      </AppShell>
    );
  }

  // Manager / Admin / Sales Analytics Dashboard Data (REAL DATABASE CALCULATIONS)
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59);

  const [
    surfaces,
    allYearOccupancies,
    ending30,
    waitingOffers,
    activeOffersList,
  ] = await Promise.all([
    prisma.advertisingSurface.findMany({
      where: { status: { not: 'OUT_OF_SERVICE' }, carrier: { archivedAt: null, status: 'ACTIVE' } },
      select: {
        id: true,
        mediaType: true,
        status: true,
        contract: { select: { status: true, startDate: true, endDate: true, monthlyPrice: true } },
        occupancies: {
          where: { status: { in: ['OCCUPIED', 'RESERVED'] }, dateFrom: { lte: now }, dateTo: { gte: now } },
          select: { status: true, price: true },
        },
        carrier: { select: { city: true } },
      },
    }),
    prisma.occupancy.findMany({
      where: {
        status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
        dateFrom: { gte: startOfYear },
        dateTo: { lte: endOfYear },
      },
      select: { dateFrom: true, surfaceId: true },
    }),
    prisma.occupancy.findMany({
      where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in30 } },
      include: { client: true, surface: { include: { carrier: true } } },
      orderBy: { dateTo: 'asc' },
      take: 15,
    }),
    prisma.offer.count({ where: { status: 'SENT' } }),
    prisma.offer.findMany({
      where: { status: { in: ['DRAFT', 'SENT'] } },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const financialStateBySurface = new Map(surfaces.map((surface) => [surface.id, deriveAnalyticsSurfaceState({
    surfaceStatus: surface.status,
    contract: surface.contract ? {
      status: surface.contract.status,
      startDate: surface.contract.startDate,
      endDate: surface.contract.endDate,
      monthlyPrice: surface.contract.monthlyPrice ? Number(surface.contract.monthlyPrice) : null,
    } : null,
    occupancies: surface.occupancies.map((item) => ({ status: item.status, price: item.price ? Number(item.price) : null })),
    asOf: now,
  })]));
  const occupiedSurfaceIds = new Set(surfaces.filter((surface) => financialStateBySurface.get(surface.id)?.isOccupied).map((surface) => surface.id));

  const totalSurfaces = surfaces.length;
  const occupiedSurfaces = occupiedSurfaceIds.size;
  const availableSurfaces = Math.max(0, totalSurfaces - occupiedSurfaces);
  const knownMonthlyRent = surfaces.reduce((sum, surface) => sum + (financialStateBySurface.get(surface.id)?.monthlyRent ?? 0), 0);
  const pricedOccupiedSurfaces = surfaces.filter((surface) => financialStateBySurface.get(surface.id)?.hasExplicitPrice).length;
  const unpricedOccupiedSurfaces = occupiedSurfaces - pricedOccupiedSurfaces;
  const annualizedKnownRent = knownMonthlyRent * 12;
  const occupancyPercent = totalSurfaces > 0 ? Math.round((occupiedSurfaces / totalSurfaces) * 100) : 0;
  const ending7 = ending30.filter((item) => new Date(item.dateTo) <= in7);

  // REAL Seasonality 12 Months
  const seasonalityData = Array(12).fill(0);
  allYearOccupancies.forEach((occ) => {
    const m = new Date(occ.dateFrom).getMonth();
    if (m >= 0 && m < 12) seasonalityData[m] += 1;
  });

  // REAL City Leaderboard
  const cityStatsMap = new Map<string, { city: string; total: number; occupiedSet: Set<string> }>();
  surfaces.forEach((s) => {
    const city = s.carrier.city?.trim() || 'Neuvedeno';
    if (!cityStatsMap.has(city)) {
      cityStatsMap.set(city, { city, total: 0, occupiedSet: new Set() });
    }
    const stat = cityStatsMap.get(city)!;
    stat.total += 1;
    if (occupiedSurfaceIds.has(s.id)) {
      stat.occupiedSet.add(s.id);
    }
  });

  const topCities = Array.from(cityStatsMap.values())
    .map((c) => ({
      city: c.city,
      total: c.total,
      occupied: c.occupiedSet.size,
      percent: c.total > 0 ? Math.round((c.occupiedSet.size / c.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // REAL Media Type Breakdown
  const mediaMap = new Map<string, { count: number; occupiedSet: Set<string>; knownMonthlyRent: number }>();
  surfaces.forEach((s) => {
    if (!mediaMap.has(s.mediaType)) {
      mediaMap.set(s.mediaType, { count: 0, occupiedSet: new Set(), knownMonthlyRent: 0 });
    }
    mediaMap.get(s.mediaType)!.count += 1;
  });

  surfaces.forEach((surface) => {
    const mt = surface.mediaType;
    if (mediaMap.has(mt)) {
      const item = mediaMap.get(mt)!;
      const state = financialStateBySurface.get(surface.id)!;
      if (state.isOccupied) item.occupiedSet.add(surface.id);
      item.knownMonthlyRent += state.monthlyRent ?? 0;
    }
  });

  const mediaBreakdown = Array.from(mediaMap.entries()).map(([type, data]) => ({
    type,
    label: mediaTypeLabel(type),
    count: data.count,
    occupiedCount: data.occupiedSet.size,
    occupancyPercent: data.count > 0 ? Math.round((data.occupiedSet.size / data.count) * 100) : 0,
    knownMonthlyRent: data.knownMonthlyRent,
  })).sort((a, b) => b.knownMonthlyRent - a.knownMonthlyRent).slice(0, 5);

  if (isSales) {
    const salesFirstName = user.employee?.firstName
      ? user.employee.firstName
      : (user.name ? user.name.split(' ')[0] : 'Obchodníku');

    return (
      <AppShell>
        <SalesDashboard
        salesName={salesFirstName}
        activeOffers={activeOffersList.map((o) => ({
          id: o.id,
          title: o.title,
          clientName: o.client.name,
          totalAmount: o.totalPrice ? Number(o.totalPrice) : 0,
          validUntil: o.validUntil,
          status: o.status,
          createdAt: o.createdAt,
        }))}
        renewals={ending30.map((o) => ({
          id: o.id,
          campaignName: o.campaignName,
          clientName: o.clientName,
          dateTo: o.dateTo,
          status: o.status,
          contactPhone: o.client?.phone || null,
          contactEmail: o.client?.email || null,
          surface: {
            carrier: {
              code: o.surface.carrier.code,
              city: o.surface.carrier.city,
              name: o.surface.carrier.name,
            },
          },
        }))}
          availableSurfacesCount={availableSurfaces}
          totalSurfacesCount={totalSurfaces}
          occupancyPercent={occupancyPercent}
          topCities={topCities}
          mediaBreakdown={mediaBreakdown}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ManagerDashboard
        totalSurfaces={totalSurfaces}
        availableSurfaces={availableSurfaces}
        occupiedSurfaces={occupiedSurfaces}
        knownMonthlyRent={knownMonthlyRent}
        annualizedKnownRent={annualizedKnownRent}
        pricedOccupiedSurfaces={pricedOccupiedSurfaces}
        unpricedOccupiedSurfaces={unpricedOccupiedSurfaces}
        occupancyPercent={occupancyPercent}
        waitingOffers={waitingOffers}
        seasonalityData={seasonalityData}
        ending7={ending7}
        mediaBreakdown={mediaBreakdown}
        topCities={topCities}
      />
    </AppShell>
  );
}
