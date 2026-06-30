import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Occupancy() {
  const carriers = await getCarriers();
  const rows = carriers.flatMap((carrier) => carrier.surfaces.flatMap((surface) => surface.occupancies.map((occupancy) => ({ carrier, surface, occupancy }))));
  return <AppShell><h1 className="text-3xl font-bold mb-6">Obsazenost</h1><div className="card">{rows.map(({ carrier, surface, occupancy }) => <div className="border-b py-3" key={occupancy.id}><b>{occupancy.campaignName}</b> · {occupancy.clientName}<p className="text-sm text-slate-500">{carrier.name} / {surface.name} · {occupancy.dateFrom} – {occupancy.dateTo} <StatusBadge value={occupancy.status}/></p></div>)}</div></AppShell>;
}
