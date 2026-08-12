import { AppShell } from '@/components/AppShell';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { WorkerDashboard } from '@/components/dashboard/WorkerDashboard';
import { SalesDashboard } from '@/components/dashboard/SalesDashboard';

export const dynamic = 'force-dynamic';

const defaultRates: Record<string, number> = {
  NAVIGATION_SIGN: 1800,
  PROMO_BENCH: 2500,
  CITY_POSTER: 3200,
  PROMO_HORIZON: 2200,
  PROMO_TOWER: 3500,
  BILLBOARD: 4500,
  CITYLIGHT: 5000,
  OTHER: 2000,
};

export default async function Dashboard() {
  const user = await requirePageAccess('dashboard');
  const role = user.role;
  const isWorkerOrTech = role === 'WORKER' || role === 'TECHNICIAN';
  const isSales = role === 'SALES';

  const today = new Date();
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
          dateTo: { gte: today },
        },
        include: { vehicle: true },
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
            status: vehicles.vehicle.status,
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
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    missingGps,
    surfaces,
    activeOccupancies,
    allYearOccupancies,
    ending30,
    waitingOffers,
    missingGpsRows,
    activeOffersList,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] } }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      select: {
        id: true,
        mediaType: true,
        price: true,
        carrier: { select: { city: true } },
      },
    }),
    prisma.occupancy.findMany({
      where: {
        status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
        dateTo: { gte: today },
      },
      include: {
        surface: {
          select: {
            id: true,
            mediaType: true,
            price: true,
            carrier: { select: { city: true } },
          },
        },
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
    prisma.advertisingCarrier.findMany({
      where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] },
      orderBy: [{ city: 'asc' }, { code: 'asc' }],
      take: 8,
      select: { id: true, code: true, name: true, city: true, street: true, address: true },
    }),
    prisma.offer.findMany({
      where: { status: { in: ['DRAFT', 'SENT'] } },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Exact Distinct Occupied Surfaces (including Navigation continuous monthly rentals)
  const occupiedSurfaceIds = new Set(activeOccupancies.map((o) => o.surfaceId));
  surfaces.forEach((s) => {
    if (s.mediaType === 'NAVIGATION_SIGN' && s.price && Number(s.price) > 0) {
      occupiedSurfaceIds.add(s.id);
    }
  });

  const totalSurfaces = surfaces.length;
  const occupiedSurfaces = occupiedSurfaceIds.size;
  const availableSurfaces = Math.max(0, totalSurfaces - occupiedSurfaces);
  const reservedSurfaces = activeOccupancies.filter((o) => o.status === 'RESERVED').length;

  // Real MRR & ARR calculation (including Navigation continuous monthly contracts)
  let mrrAmount = activeOccupancies.reduce((acc, curr) => {
    const val = curr.price
      ? Number(curr.price)
      : (curr.surface?.price ? Number(curr.surface.price) : (defaultRates[curr.surface?.mediaType] || 2000));
    return acc + val;
  }, 0);

  surfaces.forEach((s) => {
    if (s.mediaType === 'NAVIGATION_SIGN' && s.price && Number(s.price) > 0) {
      if (!activeOccupancies.some((occ) => occ.surfaceId === s.id)) {
        mrrAmount += Number(s.price);
      }
    }
  });

  const arrAmount = mrrAmount * 12;
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
  const mediaMap = new Map<string, { count: number; occupiedSet: Set<string>; revenue: number }>();
  surfaces.forEach((s) => {
    if (!mediaMap.has(s.mediaType)) {
      mediaMap.set(s.mediaType, { count: 0, occupiedSet: new Set(), revenue: 0 });
    }
    mediaMap.get(s.mediaType)!.count += 1;
  });

  activeOccupancies.forEach((occ) => {
    const mt = occ.surface.mediaType;
    if (mediaMap.has(mt)) {
      const item = mediaMap.get(mt)!;
      item.occupiedSet.add(occ.surfaceId);
      const val = occ.price
        ? Number(occ.price)
        : (occ.surface?.price ? Number(occ.surface.price) : (defaultRates[mt] || 2000));
      item.revenue += val;
    }
  });

  const mediaBreakdown = Array.from(mediaMap.entries()).map(([type, data]) => ({
    type,
    label: mediaTypeLabel(type),
    count: data.count,
    occupiedCount: data.occupiedSet.size,
    occupancyPercent: data.count > 0 ? Math.round((data.occupiedSet.size / data.count) * 100) : 0,
    estimatedRevenue: data.revenue,
  })).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 5);

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
        totalCarriers={totalCarriers}
        activeCarriers={activeCarriers}
        archivedCarriers={archivedCarriers}
        missingGps={missingGps}
        totalSurfaces={totalSurfaces}
        availableSurfaces={availableSurfaces}
        occupiedSurfaces={occupiedSurfaces}
        reservedSurfaces={reservedSurfaces}
        mrrAmount={mrrAmount}
        arrAmount={arrAmount}
        occupancyPercent={occupancyPercent}
        waitingOffers={waitingOffers}
        seasonalityData={seasonalityData}
        ending7={ending7}
        ending30={ending30}
        missingGpsRows={missingGpsRows}
        mediaBreakdown={mediaBreakdown}
        topCities={topCities}
      />
    </AppShell>
  );
}
