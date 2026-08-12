import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';
import { AlertTriangle, Fuel, ShieldCheck } from 'lucide-react';

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

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      fuelExpenses: true,
      _count: { select: { reservations: true, serviceRecords: true, workTasks: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 500,
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Compute STK alerts
  const stkAlerts = vehicles.filter((v) => {
    if (!v.technicalInspectionUntil) return false;
    const stkDate = new Date(v.technicalInspectionUntil);
    const diffDays = Math.ceil((stkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vozidla, vozíky & Kniha jízd</h1>
          <p className="mt-1 text-sm text-slate-500">Evidence vozového parku, hlídání termínů STK a přehled tankování paliva z chatu.</p>
        </div>
        <Link className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-800 transition" href="/vehicle-reservations">
          Rezervace vozidel ↗
        </Link>
      </div>

      {stkAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>⚠️ Upozornění na STK u vozidel ({stkAlerts.length})</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {stkAlerts.map((v) => {
              const stkDate = new Date(v.technicalInspectionUntil!);
              const diffDays = Math.ceil((stkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = diffDays < 0;
              return (
                <span key={v.id} className={`rounded-lg px-2.5 py-1 border font-bold ${isExpired ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-amber-100 text-amber-900 border-amber-300'}`}>
                  {v.name} ({v.registrationNumber}): {isExpired ? `🚨 STK Prošlá (${Math.abs(diffDays)} dní po termínu)` : `⚠️ Vyprší za ${diffDays} dní`}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <form className="card mb-6 grid gap-3 md:grid-cols-4">
        <label className="text-sm font-semibold">Hledání<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="q" defaultValue={q} placeholder="Název, SPZ, VIN" /></label>
        <label className="text-sm font-semibold">Typ<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="type" defaultValue={type ?? ''}><option value="">Všechny typy</option>{vehicleTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-semibold">Stav<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="status" defaultValue={status ?? ''}><option value="">Všechny stavy</option>{vehicleStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <div className="flex items-end"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrovat</button></div>
      </form>

      <section className="card overflow-x-auto">
        {vehicles.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím není evidované žádné vozidlo ani vozík.</p>
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b py-2 pr-3">Vozidlo</th>
                <th className="border-b py-2 pr-3">Typ</th>
                <th className="border-b py-2 pr-3">SPZ / VIN</th>
                <th className="border-b py-2 pr-3">Stav</th>
                <th className="border-b py-2 pr-3">Kontrola STK</th>
                <th className="border-b py-2 pr-3">Palivo (Účtenky z chatu)</th>
                <th className="border-b py-2 pr-3">Rezervace</th>
                <th className="border-b py-2 pr-3">Servis</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const totalFuelKcs = vehicle.fuelExpenses.reduce((sum, fe) => sum + Number(fe.amount), 0);
                const totalLiters = vehicle.fuelExpenses.reduce((sum, fe) => sum + (fe.liters ? Number(fe.liters) : 0), 0);

                let stkBadge = null;
                if (vehicle.technicalInspectionUntil) {
                  const stkDate = new Date(vehicle.technicalInspectionUntil);
                  const diffDays = Math.ceil((stkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) {
                    stkBadge = <span className="rounded-md bg-rose-100 text-rose-900 px-1.5 py-0.5 text-[10px] font-black uppercase border border-rose-200">🚨 Prošlá</span>;
                  } else if (diffDays <= 30) {
                    stkBadge = <span className="rounded-md bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[10px] font-black uppercase border border-amber-200">⚠️ {diffDays} dní</span>;
                  } else {
                    stkBadge = <span className="rounded-md bg-emerald-100 text-emerald-900 px-1.5 py-0.5 text-[10px] font-bold border border-emerald-200">🟢 Platná</span>;
                  }
                }

                return (
                  <tr className="border-b last:border-0" key={vehicle.id}>
                    <td className="py-3 pr-3">
                      <Link className="font-semibold hover:underline text-slate-900" href={`/vehicles/${vehicle.id}`}>
                        {vehicle.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-600">{vehicle.type}</td>
                    <td className="py-3 pr-3">
                      <span className="font-bold text-slate-900">{vehicle.registrationNumber ?? '-'}</span>
                      <br />
                      <span className="text-[11px] text-slate-400 font-mono">{vehicle.vin ?? '-'}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill value={vehicle.status} />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">{dateOnly(vehicle.technicalInspectionUntil)}</span>
                        {stkBadge}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      {vehicle.fuelExpenses.length > 0 ? (
                        <div className="text-xs">
                          <span className="font-extrabold text-slate-900">{Math.round(totalFuelKcs).toLocaleString('cs-CZ')} Kč</span>
                          <span className="text-slate-500 block text-[11px]">{totalLiters ? `${totalLiters.toFixed(1)} l · ` : ''}{vehicle.fuelExpenses.length} účtenek</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Bez účtenek</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-700">{vehicle._count.reservations}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-700">{vehicle._count.serviceRecords}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
