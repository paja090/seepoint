import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const vehicleTypes = ['CAR', 'VAN', 'TRAILER', 'OTHER'] as const;
const vehicleStatuses = ['AVAILABLE', 'RESERVED', 'IN_USE', 'SERVICE', 'OUT_OF_SERVICE'] as const;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('vehicles');
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  const params = await searchParams;
  const q = clean(params.q);
  const type = clean(params.type);
  const status = clean(params.status);
  const where: Prisma.VehicleWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { registrationNumber: { contains: q, mode: 'insensitive' } }, { vin: { contains: q, mode: 'insensitive' } }];
  if (type && vehicleTypes.includes(type as typeof vehicleTypes[number])) where.type = type as typeof vehicleTypes[number];
  if (status && vehicleStatuses.includes(status as typeof vehicleStatuses[number])) where.status = status as typeof vehicleStatuses[number];
  const vehicles = await prisma.vehicle.findMany({ where, include: { _count: { select: { reservations: true, serviceRecords: true, workTasks: true } } }, orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 500 });
  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">Vozidla a vozíky</h1><p className="mt-1 text-sm text-slate-500">Evidence aut, dodávek, vozíků a jejich provozního stavu.</p></div><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/vehicle-reservations">Rezervace vozidel</Link></div>
      <form className="card mb-6 grid gap-3 md:grid-cols-4"><label className="text-sm font-semibold">Hledání<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="q" defaultValue={q} placeholder="Název, SPZ, VIN" /></label><label className="text-sm font-semibold">Typ<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="type" defaultValue={type ?? ''}><option value="">Všechny typy</option>{vehicleTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-sm font-semibold">Stav<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="status" defaultValue={status ?? ''}><option value="">Všechny stavy</option>{vehicleStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex items-end"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrovat</button></div></form>
      <section className="card overflow-x-auto">{vehicles.length === 0 ? <p className="text-sm text-slate-500">Zatím není evidované žádné vozidlo ani vozík.</p> : <table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Vozidlo</th><th className="border-b py-2 pr-3">Typ</th><th className="border-b py-2 pr-3">SPZ / VIN</th><th className="border-b py-2 pr-3">Stav</th><th className="border-b py-2 pr-3">STK</th><th className="border-b py-2 pr-3">Pojištění</th><th className="border-b py-2 pr-3">Rezervace</th><th className="border-b py-2 pr-3">Servis</th></tr></thead><tbody>{vehicles.map((vehicle) => <tr className="border-b last:border-0" key={vehicle.id}><td className="py-3 pr-3"><Link className="font-semibold hover:underline" href={`/vehicles/${vehicle.id}`}>{vehicle.name}</Link></td><td className="py-3 pr-3">{vehicle.type}</td><td className="py-3 pr-3">{vehicle.registrationNumber ?? '-'}<br /><span className="text-slate-500">{vehicle.vin ?? '-'}</span></td><td className="py-3 pr-3"><StatusPill value={vehicle.status} /></td><td className="py-3 pr-3">{dateOnly(vehicle.technicalInspectionUntil)}</td><td className="py-3 pr-3">{dateOnly(vehicle.insuranceUntil)}</td><td className="py-3 pr-3">{vehicle._count.reservations}</td><td className="py-3 pr-3">{vehicle._count.serviceRecords}</td></tr>)}</tbody></table>}</section>
    </AppShell>
  );
}
