import { AppShell } from '@/components/AppShell';
import { getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const carriers = await getCarriers();
  const surfaces = carriers.flatMap((carrier) => carrier.surfaces);
  const occupied = surfaces.filter((surface) => surface.status === 'OCCUPIED').length;
  const reserved = surfaces.filter((surface) => surface.status === 'RESERVED').length;
  const available = surfaces.filter((surface) => surface.status === 'AVAILABLE').length;
  const stats = [
    ['Celkem nosičů', carriers.length],
    ['Aktivní nosiče', carriers.filter((carrier) => carrier.status === 'ACTIVE').length],
    ['Volné plochy', available],
    ['Obsazené plochy', occupied],
    ['Rezervované plochy', reserved],
    ['Obsazenost', `${Math.round((occupied / Math.max(surfaces.length, 1)) * 100)} %`],
  ];
  const month = new Date().toISOString().slice(0, 7);
  const ending = surfaces.flatMap((surface) => surface.occupancies).filter((occupancy) => occupancy.dateTo.startsWith(month));
  return <AppShell><h1 className="text-3xl font-bold mb-6">Dashboard</h1><div className="grid md:grid-cols-3 gap-4">{stats.map(([label, value]) => <div className="card" key={label}><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-bold mt-2">{value}</p></div>)}</div><div className="card mt-6"><h2 className="font-semibold mb-3">Kampaně končící tento měsíc</h2>{ending.map((occupancy) => <p className="border-b py-2" key={occupancy.id}>{occupancy.campaignName} · {occupancy.clientName} · do {occupancy.dateTo}</p>)}</div></AppShell>;
}
