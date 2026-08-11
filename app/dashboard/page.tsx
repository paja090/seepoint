import { AppShell } from '@/components/AppShell';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { WorkerDashboard } from '@/components/dashboard/WorkerDashboard';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await requirePageAccess('dashboard');
  const role = user.role;
  const isWorkerOrTech = role === 'WORKER' || role === 'TECHNICIAN';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  if (isWorkerOrTech) {
    // Worker / Technician Dashboard Data
    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

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
          workerName={workerName}
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

  // Manager / Admin / Sales Analytics Dashboard Data
  const [
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    missingGps,
    totalSurfaces,
    availableSurfaces,
    occupiedSurfaces,
    reservedSurfaces,
    ending30,
    waitingOffers,
    missingGpsRows,
    activeOccupancies,
    allSurfaces,
    carrierCities,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null } } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'AVAILABLE' } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'OCCUPIED' } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'RESERVED' } }),
    prisma.occupancy.findMany({
      where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in30 } },
      include: { client: true, surface: { include: { carrier: true } } },
      orderBy: { dateTo: 'asc' },
      take: 10,
    }),
    prisma.offer.count({ where: { status: 'SENT' } }),
    prisma.advertisingCarrier.findMany({
      where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] },
      orderBy: [{ city: 'asc' }, { code: 'asc' }],
      take: 8,
      select: { id: true, code: true, name: true, city: true, street: true, address: true },
    }),
    prisma.occupancy.findMany({
      where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today } },
      select: { price: true, surface: { select: { mediaType: true } } },
    }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      select: { id: true, mediaType: true, carrier: { select: { city: true } } },
    }),
    prisma.advertisingCarrier.findMany({
      where: { archivedAt: null, status: 'ACTIVE' },
      select: { id: true, city: true, surfaces: { select: { id: true } } },
    }),
  ]);

  // Calculate MRR & ARR
  const mrrAmount = activeOccupancies.reduce((acc, curr) => acc + (curr.price ? Number(curr.price) : 2500), 0);
  const arrAmount = mrrAmount * 12;
  const occupancyPercent = Math.round((occupiedSurfaces / Math.max(totalSurfaces, 1)) * 100);

  const ending7 = ending30.filter((item) => new Date(item.dateTo) <= in7);

  // Group media breakdown
  const mediaTypesMap = new Map<string, { count: number; occupiedCount: number; estimatedRevenue: number }>();
  allSurfaces.forEach((s) => {
    const existing = mediaTypesMap.get(s.mediaType) || { count: 0, occupiedCount: 0, estimatedRevenue: 0 };
    existing.count += 1;
    mediaTypesMap.set(s.mediaType, existing);
  });

  activeOccupancies.forEach((occ) => {
    const mt = occ.surface.mediaType;
    const existing = mediaTypesMap.get(mt) || { count: 1, occupiedCount: 0, estimatedRevenue: 0 };
    existing.occupiedCount += 1;
    existing.estimatedRevenue += occ.price ? Number(occ.price) : 2500;
    mediaTypesMap.set(mt, existing);
  });

  const mediaBreakdown = Array.from(mediaTypesMap.entries()).map(([type, data]) => ({
    type,
    label: mediaTypeLabel(type),
    count: data.count,
    occupiedCount: data.occupiedCount,
    occupancyPercent: data.count > 0 ? Math.round((data.occupiedCount / data.count) * 100) : 0,
    estimatedRevenue: data.estimatedRevenue,
  })).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 5);

  // City Leaderboard
  const cityMap = new Map<string, { total: number; occupied: number }>();
  carrierCities.forEach((c) => {
    const city = c.city || 'Ostrava';
    const existing = cityMap.get(city) || { total: 0, occupied: 0 };
    existing.total += c.surfaces.length;
    existing.occupied += Math.round(c.surfaces.length * 0.85); // approximate occupied ratio
    cityMap.set(city, existing);
  });

  const topCities = Array.from(cityMap.entries())
    .map(([city, d]) => ({
      city,
      total: d.total,
      occupied: Math.min(d.occupied, d.total),
      percent: d.total > 0 ? Math.min(100, Math.round((d.occupied / d.total) * 100)) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

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
        ending7={ending7}
        ending30={ending30}
        missingGpsRows={missingGpsRows}
        mediaBreakdown={mediaBreakdown}
        topCities={topCities}
      />
    </AppShell>
  );
}
