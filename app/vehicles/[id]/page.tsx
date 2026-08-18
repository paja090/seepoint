import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';
import { UserCheck, FileText, AlertTriangle, ShieldCheck, Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('vehicles');
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  await ensureVehicleSchema();

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      reservations: { include: { employee: true }, orderBy: { dateFrom: 'desc' }, take: 20 },
      serviceRecords: { orderBy: { date: 'desc' }, take: 20 },
      workTasks: { include: { assignedTo: true }, orderBy: { scheduledDate: 'desc' }, take: 20 },
      fuelExpenses: { include: { employee: true }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!vehicle) notFound();

  const totalFuelCost = vehicle.fuelExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-xs text-slate-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
              {vehicle.registrationNumber ?? 'Bez SPZ'}
            </span>
            {vehicle.owner && (
              <span className="text-xs font-bold uppercase text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                Vlastník: {vehicle.owner}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">{vehicle.name}</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            {vehicle.type === 'VAN' ? '🚚 Dodávka' : vehicle.type === 'TRAILER' ? '🪧 Billboardový vozík' : '🚘 Osobní auto'} · Detail a provozní údaje
          </p>
        </div>
        <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition" href="/vehicles">
          ← Zpět na seznam vozidel
        </Link>
      </div>

      <section className="card mb-6">
        <h2 className="mb-4 text-lg font-black text-slate-900 border-b border-slate-200 pb-2">Provozní údaje & Dokumentace</h2>
        <dl className="grid gap-4 text-xs md:grid-cols-4">
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Stav vozidla</dt>
            <dd className="mt-1"><StatusPill value={vehicle.status} /></dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Zodpovědná osoba / Řidič</dt>
            <dd className="mt-1 font-extrabold text-slate-900 flex items-center gap-1.5">
              <UserCheck size={16} className="text-sky-600" />
              {vehicle.responsiblePerson ?? 'Neuvedena'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">VIN kód</dt>
            <dd className="mt-1 font-mono font-bold text-slate-900">{vehicle.vin ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">STK platná do</dt>
            <dd className="mt-1 font-extrabold text-slate-900">{dateOnly(vehicle.technicalInspectionUntil)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Pojištění do</dt>
            <dd className="mt-1 font-bold text-slate-900">{dateOnly(vehicle.insuranceUntil)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Dálniční známka do</dt>
            <dd className="mt-1 font-bold text-emerald-800">{dateOnly(vehicle.highwayPassUntil)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Pneumatiky & Rozměr</dt>
            <dd className="mt-1 font-bold text-slate-900">🛞 {vehicle.tiresInfo ?? 'Neuvedeno'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Techničák (VTP)</dt>
            <dd className="mt-1">
              {vehicle.vtpUrl ? (
                <a
                  href={vehicle.vtpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-black text-sky-700 hover:underline"
                >
                  📄 Zobrazit VTP v Google Disku ↗
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </dd>
          </div>
        </dl>

        {vehicle.repairNotes && (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-950 font-medium">
            <strong className="block font-black text-rose-900 text-sm mb-1 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-rose-600" />
              Závady a poznámky k opravám:
            </strong>
            <p className="font-bold">{vehicle.repairNotes}</p>
          </div>
        )}

        {vehicle.note && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
            <strong>Poznámka:</strong> {vehicle.note}
          </div>
        )}
      </section>

      {/* Fuel Expenses Section */}
      <section className="card mt-6 border-amber-200 bg-amber-50/40">
        <div className="flex items-center justify-between border-b border-amber-200/60 pb-3 mb-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">⛽ Účtenky za Palivo & Tankování</h2>
            <p className="text-xs text-slate-600 font-medium">Provozní náklady na palivo nahrané z mobilního týmového chatu</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase text-amber-800">Celkem za palivo</span>
            <p className="text-lg font-black text-amber-950">{totalFuelCost.toLocaleString('cs-CZ')} Kč</p>
          </div>
        </div>

        {vehicle.fuelExpenses.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 font-medium">Zatím nebyly k tomuto vozidlu nahrány žádné účtenky za palivo.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehicle.fuelExpenses.map((expense) => (
              <div key={expense.id} className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-black text-amber-900">{Number(expense.amount).toLocaleString('cs-CZ')} Kč</span>
                    {expense.liters && <span className="text-xs text-slate-600 font-semibold ml-1">({Number(expense.liters)} l)</span>}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {expense.employee ? `${expense.employee.firstName} ${expense.employee.lastName}` : 'Montážník'} · {new Date(expense.createdAt).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>

                  {expense.receiptUrl && (
                    <a
                      href={expense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900 font-bold hover:bg-amber-200 transition"
                      title="Zobrazit účtenku"
                    >
                      📷
                    </a>
                  )}
                </div>

                {expense.odometer && (
                  <p className="mt-2 text-xs font-mono font-bold text-slate-700 bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                    Stav tacho: {expense.odometer.toLocaleString('cs-CZ')} km
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
