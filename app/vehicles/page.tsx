import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';
import { AlertTriangle, Car, Truck, FileText, UserCheck, ShieldCheck, Wrench, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const vehicleTypes = ['CAR', 'VAN', 'TRAILER', 'OTHER'] as const;
const vehicleStatuses = ['AVAILABLE', 'RESERVED', 'IN_USE', 'SERVICE', 'OUT_OF_SERVICE'] as const;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('vehicles');
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  await ensureVehicleSchema();

  const params = await searchParams;
  const q = clean(params.q);
  const type = clean(params.type);
  const status = clean(params.status);
  const where: Prisma.VehicleWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { registrationNumber: { contains: q, mode: 'insensitive' } },
      { vin: { contains: q, mode: 'insensitive' } },
      { responsiblePerson: { contains: q, mode: 'insensitive' } },
    ];
  }
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

  // Compute STK & Highway Pass alerts
  const stkAlerts = vehicles.filter((v) => {
    if (!v.technicalInspectionUntil) return false;
    const stkDate = new Date(v.technicalInspectionUntil);
    const diffDays = Math.ceil((stkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  });

  const activeVehiclesCount = vehicles.filter((v) => v.status !== 'OUT_OF_SERVICE').length;
  const trailersCount = vehicles.filter((v) => v.type === 'TRAILER').length;
  const vansCount = vehicles.filter((v) => v.type === 'VAN').length;

  return (
    <AppShell>
      {/* HEADER BAR */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Auta, Vozíky & Flotila</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Kompletní evidence vozového parku SeePOINT (auta, dodávky, billboardové vozíky, STK, rezervace a dálniční známky).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-sky-500 hover:to-emerald-500 transition"
            href="/vehicle-reservations"
          >
            <span>📅 Kalendář & Rezervace ↗</span>
          </Link>
        </div>
      </div>

      {/* STAT SUMMARY TILES */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Aktivní vozidla</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{activeVehiclesCount}</p>
          <span className="text-[10px] text-slate-400 font-semibold">ve vozovém parku</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Billboardové vozíky</span>
          <p className="mt-1 text-2xl font-black text-sky-900">{trailersCount}</p>
          <span className="text-[10px] text-sky-700 font-semibold">1-nápravové i 2-nápravové</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Dodávky & Van</span>
          <p className="mt-1 text-2xl font-black text-emerald-900">{vansCount}</p>
          <span className="text-[10px] text-emerald-700 font-semibold">Renault Master, Trafic, H1</span>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-amber-800 tracking-wider">Upozornění STK</span>
          <p className="mt-1 text-2xl font-black text-amber-950">{stkAlerts.length}</p>
          <span className="text-[10px] text-amber-700 font-semibold">vyžaduje kontrolu do 30 dní</span>
        </div>
      </div>

      {/* STK ALERT BANNER */}
      {stkAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>⚠️ Upozornění na vypršení STK ({stkAlerts.length} vozidel)</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {stkAlerts.map((v) => {
              const stkDate = new Date(v.technicalInspectionUntil!);
              const diffDays = Math.ceil((stkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = diffDays < 0;
              return (
                <span
                  key={v.id}
                  className={`rounded-xl px-3 py-1 border font-bold flex items-center gap-1.5 ${
                    isExpired ? 'bg-rose-100 text-rose-950 border-rose-300' : 'bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  <span>{v.name} ({v.registrationNumber ?? 'Bez SPZ'}):</span>
                  <strong>{isExpired ? `🚨 Prošlá (${Math.abs(diffDays)} dní po termínu)` : `⚠️ Za ${diffDays} dní (${stkDate.toLocaleDateString('cs-CZ')})`}</strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTERS FORM */}
      <form className="card mb-6 grid gap-3 md:grid-cols-4">
        <label className="text-xs font-bold text-slate-700">
          Vyhledat vozidlo
          <input
            className="input mt-1 w-full text-xs font-normal"
            name="q"
            defaultValue={q}
            placeholder="Název, SPZ, VIN nebo řidič..."
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          Typ vozidla
          <select className="input mt-1 w-full text-xs font-normal" name="type" defaultValue={type ?? ''}>
            <option value="">Všechny typy vozidel</option>
            <option value="CAR">🚘 Osobní auta</option>
            <option value="VAN">🚚 Dodávky & Užitkové</option>
            <option value="TRAILER">🪧 Billboardové vozíky</option>
            <option value="OTHER">🛵 Skútry & Ostatní</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">
          Stav vozidla
          <select className="input mt-1 w-full text-xs font-normal" name="status" defaultValue={status ?? ''}>
            <option value="">Všechny stavy</option>
            <option value="AVAILABLE">🟢 K dispozici</option>
            <option value="RESERVED">🟡 Rezervováno</option>
            <option value="IN_USE">🔵 V provozu</option>
            <option value="SERVICE">🔧 V servisu</option>
            <option value="OUT_OF_SERVICE">🔴 Vyřazeno</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition">
            Filtrovat flotilu
          </button>
        </div>
      </form>

      {/* FLEET TABLE */}
      <section className="card overflow-x-auto p-0 border border-slate-200">
        {vehicles.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Zatím nebylo nalezeno žádné vozidlo odpovídající filtru.
          </div>
        ) : (
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Vozidlo / Název</th>
                <th className="py-3 px-3">Typ</th>
                <th className="py-3 px-3">SPZ / VIN / Vlastník</th>
                <th className="py-3 px-3">Zodpovědná osoba</th>
                <th className="py-3 px-3">Pneu & VTP</th>
                <th className="py-3 px-3">Dálnička & STK</th>
                <th className="py-3 px-3">Poznámky & Závady</th>
                <th className="py-3 px-4 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {vehicles.map((vehicle) => {
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

                let typeBadge = '🚘 Auto';
                if (vehicle.type === 'VAN') typeBadge = '🚚 Dodávka';
                if (vehicle.type === 'TRAILER') typeBadge = '🪧 Vozík';
                if (vehicle.type === 'OTHER') typeBadge = '🛵 Ostatní';

                return (
                  <tr className="hover:bg-slate-50/80 transition" key={vehicle.id}>
                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {vehicle.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={vehicle.photoUrl}
                            alt={vehicle.name}
                            className="h-10 w-14 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="flex h-10 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 font-bold text-xs shrink-0 border border-slate-200">
                            📷
                          </div>
                        )}
                        <div>
                          <Link className="font-extrabold text-slate-900 hover:text-sky-700 text-sm block" href={`/vehicles/${vehicle.id}`}>
                            {vehicle.name}
                          </Link>
                          <div className="mt-0.5">
                            <StatusPill value={vehicle.status} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                        {typeBadge}
                      </span>
                    </td>

                    {/* Registration Number, VIN, Owner */}
                    <td className="py-3 px-3">
                      <span className="font-mono font-black text-slate-900 text-xs bg-amber-100 px-2 py-0.5 rounded border border-amber-200 inline-block">
                        {vehicle.registrationNumber ?? 'Bez SPZ'}
                      </span>
                      {vehicle.owner && (
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                          {vehicle.owner}
                        </span>
                      )}
                      {vehicle.vin && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          VIN: {vehicle.vin}
                        </span>
                      )}
                    </td>

                    {/* Responsible Person */}
                    <td className="py-3 px-3">
                      {vehicle.responsiblePerson ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-slate-800 text-xs bg-sky-50 text-sky-950 px-2.5 py-1 rounded-xl border border-sky-200">
                          <UserCheck size={12} className="text-sky-600" />
                          {vehicle.responsiblePerson}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Tires & VTP */}
                    <td className="py-3 px-3">
                      {vehicle.tiresInfo && (
                        <span className="text-xs font-semibold text-slate-700 block">
                          🛞 {vehicle.tiresInfo}
                        </span>
                      )}
                      {vehicle.vtpUrl && (
                        <a
                          href={vehicle.vtpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline mt-0.5"
                        >
                          📄 Otevřít VTP ↗
                        </a>
                      )}
                    </td>

                    {/* Highway pass & STK */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-semibold">STK:</span>
                          <span className="font-bold text-slate-900">{dateOnly(vehicle.technicalInspectionUntil)}</span>
                          {stkBadge}
                        </div>
                        {vehicle.highwayPassUntil && (
                          <div className="text-[11px] text-emerald-800 font-bold">
                            🎫 Dálniční do: {dateOnly(vehicle.highwayPassUntil)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Repair Notes */}
                    <td className="py-3 px-3 max-w-[220px]">
                      {vehicle.repairNotes ? (
                        <span className="text-xs font-bold text-rose-900 bg-rose-50 px-2 py-1 rounded-xl border border-rose-200 block truncate" title={vehicle.repairNotes}>
                          ⚠️ {vehicle.repairNotes}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Bez závažných závad</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
                        href={`/vehicles/${vehicle.id}`}
                      >
                        Detail ➔
                      </Link>
                    </td>
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
