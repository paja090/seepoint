import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function percent(value: number, total: number) {
  return `${Math.round((value / Math.max(total, 1)) * 100)} %`;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function Dashboard() {
  const activeCarrierWhere = { archivedAt: null };
  const activeSurfaceWhere = { carrier: activeCarrierWhere };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    carriersWithGps,
    carriersMissingGps,
    totalSurfaces,
    availableSurfaces,
    occupiedSurfaces,
    reservedSurfaces,
    ending,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: activeCarrierWhere }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { ...activeCarrierWhere, latitude: { not: null }, longitude: { not: null } } }),
    prisma.advertisingCarrier.count({
      where: {
        ...activeCarrierWhere,
        OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }],
      },
    }),
    prisma.advertisingSurface.count({ where: activeSurfaceWhere }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'AVAILABLE' } }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'OCCUPIED' } }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'RESERVED' } }),
    prisma.occupancy.findMany({
      where: {
        dateTo: { gte: monthStart, lt: nextMonthStart },
        surface: { carrier: activeCarrierWhere },
      },
      include: { surface: { include: { carrier: true } } },
      orderBy: { dateTo: 'asc' },
      take: 20,
    }),
  ]);

  const stats = [
    ['Celkem nosičů', totalCarriers],
    ['Aktivní nosiče', activeCarriers],
    ['Archivované nosiče', archivedCarriers],
    ['Nosiče s GPS', carriersWithGps],
    ['Nosiče bez GPS', carriersMissingGps],
    ['Volné plochy', availableSurfaces],
    ['Obsazené plochy', occupiedSurfaces],
    ['Rezervované plochy', reservedSurfaces],
    ['Obsazenost', percent(occupiedSurfaces, totalSurfaces)],
  ];

  return (
    <AppShell>
      <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="mb-3 font-semibold">Kampaně končící tento měsíc</h2>
        {ending.map((occupancy) => (
          <p className="border-b py-2" key={occupancy.id}>
            {occupancy.campaignName} · {occupancy.clientName} · {occupancy.surface.carrier.code} · do {dateOnly(occupancy.dateTo)}
          </p>
        ))}
        {ending.length === 0 && <p className="text-sm text-slate-500">Žádná kampaň nekončí tento měsíc.</p>}
      </div>
    </AppShell>
  );
}
