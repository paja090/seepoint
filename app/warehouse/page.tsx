import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { WarehouseItemModal } from '@/components/warehouse/WarehouseItemModal';
import { WarehouseMovementModal } from '@/components/warehouse/WarehouseMovementModal';
import { WarehouseVoiceInputModal } from '@/components/warehouse/WarehouseVoiceInputModal';
import { WarehousePhotoScannerModal } from '@/components/warehouse/WarehousePhotoScannerModal';
import { WarehouseAiImportModal } from '@/components/warehouse/WarehouseAiImportModal';
import { MobileWarehouseAppClient } from '@/components/warehouse/MobileWarehouseAppClient';
import { RestockButton } from '@/components/warehouse/RestockButton';
import { Package, AlertTriangle, ArrowUpRight, ArrowDownLeft, RotateCcw, Building2, MapPin, Wrench, ShoppingCart, Printer, Camera, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function WarehousePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('vehicles'); // Standard manager access
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  await ensureWarehouseSchema();

  const params = await searchParams;
  const q = clean(params.q);
  const categoryFilter = clean(params.category);
  const lowStockOnly = clean(params.lowStock) === 'true';

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { supplierName: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (categoryFilter && ['CONSUMABLE', 'RETURNABLE'].includes(categoryFilter)) {
    where.category = categoryFilter;
  }

  const [itemsRaw, workOrders, employees, recentMovementsRaw] = await Promise.all([
    prisma.warehouseItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.workOrder.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] } },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      select: { id: true, title: true, clientName: true },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.warehouseMovement.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { item: true, workOrder: true },
    }),
  ]);

  let items = itemsRaw;
  if (lowStockOnly) {
    items = items.filter((item) => item.minQuantity !== null && Number(item.quantityInStock) < Number(item.minQuantity));
  }

  const lowStockItems = itemsRaw.filter((item) => item.minQuantity !== null && Number(item.quantityInStock) < Number(item.minQuantity));
  const returnableItems = itemsRaw.filter((item) => item.category === 'RETURNABLE');
  const consumableItems = itemsRaw.filter((item) => item.category === 'CONSUMABLE');

  return (
    <AppShell>
      {/* Mobile-first Warehouse Quick App (< lg) */}
      <div className="block lg:hidden mb-6">
        <MobileWarehouseAppClient
          items={itemsRaw.map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantityInStock: Number(item.quantityInStock),
            minQuantity: item.minQuantity ? Number(item.minQuantity) : null,
            location: item.location,
            supplierName: item.supplierName,
          }))}
          workOrders={workOrders}
          employees={employees}
          recentMovements={recentMovementsRaw.map((m) => ({
            id: m.id,
            type: m.type,
            quantity: Number(m.quantity),
            performedByName: m.performedByName,
            assignedEmployeeName: m.assignedEmployeeName,
            createdAt: m.createdAt,
            item: {
              id: m.item.id,
              name: m.item.name,
              category: m.item.category,
              unit: m.item.unit,
            },
            workOrder: m.workOrder
              ? {
                  id: m.workOrder.id,
                  title: m.workOrder.title,
                  clientName: m.workOrder.clientName,
                }
              : null,
          }))}
          currentUserName={user.name || undefined}
        />
      </div>

      {/* Header Bar */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sklad & Spotřební materiál</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Evidence stahovacích pásek, lepidel, spojovacího materiálu, nářadí a výdejů k zakázkám.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WarehouseAiImportModal />
          <WarehouseVoiceInputModal workOrders={workOrders} employees={employees} />
          <WarehousePhotoScannerModal workOrders={workOrders} employees={employees} />

          <Link
            className="flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
            href="/warehouse/print-qr"
          >
            <Printer size={15} />
            <span>🖨️ Tisk QR štítků</span>
          </Link>

          <WarehouseItemModal />

          <Link className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition" href="/shopping">
            🛒 Otevřít Nákupy
          </Link>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Celkem položek ve skladu</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{itemsRaw.length}</p>
          <span className="text-[10px] text-slate-400 font-semibold">{consumableItems.length} spotřebních · {returnableItems.length} vratných</span>
        </div>

        <div className={`rounded-2xl border p-4 shadow-2xs ${lowStockItems.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] font-bold uppercase text-rose-800 tracking-wider flex items-center gap-1">
            <AlertTriangle size={14} className="text-rose-600" />
            Nízký stav zásob
          </span>
          <p className="mt-1 text-2xl font-black text-rose-950">{lowStockItems.length}</p>
          <span className="text-[10px] text-rose-700 font-semibold">položek pod minimálním limitem</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Vratné vybavení & Nářadí</span>
          <p className="mt-1 text-2xl font-black text-sky-900">{returnableItems.length}</p>
          <span className="text-[10px] text-sky-700 font-semibold">žebříky, vrtačky, minitowery</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Pohyby ve skladu</span>
          <p className="mt-1 text-2xl font-black text-emerald-900">{recentMovementsRaw.length}</p>
          <span className="text-[10px] text-emerald-700 font-semibold">posledních pohybů v evidenci</span>
        </div>
      </div>

      {/* Filter Form */}
      <form className="card mb-6 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-700">Hledat položku / dodavatele / regál</label>
          <input
            className="input mt-1 w-full text-xs font-normal"
            name="q"
            placeholder="např. pásky, lepidlo, Hornbach, Regál A1..."
            defaultValue={q ?? ''}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700">Kategorie</label>
          <select className="input mt-1 w-full text-xs font-normal" name="category" defaultValue={categoryFilter ?? ''}>
            <option value="">Všechny kategorie</option>
            <option value="CONSUMABLE">📦 Spotřební materiál</option>
            <option value="RETURNABLE">🔨 Vratné nářadí a vybavení</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button className="w-full rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition">
            Filtrovat
          </button>
          <Link
            className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition flex items-center justify-center whitespace-nowrap ${lowStockOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
            href={lowStockOnly ? '/warehouse' : '/warehouse?lowStock=true'}
          >
            ⚠️ Nízký stav ({lowStockItems.length})
          </Link>
        </div>
      </form>

      {/* Items Table */}
      <section className="card overflow-x-auto p-0 border border-slate-200 mb-8">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">
            Zatím nebyla nalezena žádná skladová položka odpovídající zadanému filtru.
          </div>
        ) : (
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Skladová položka</th>
                <th className="py-3 px-3">Typ</th>
                <th className="py-3 px-3">Stav na skladě</th>
                <th className="py-3 px-3">Min. zásoba</th>
                <th className="py-3 px-3">Umístění</th>
                <th className="py-3 px-3">Dodavatel</th>
                <th className="py-3 px-4 text-right">Akce & Pohyby</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {items.map((item) => {
                const stock = Number(item.quantityInStock);
                const min = item.minQuantity ? Number(item.minQuantity) : null;
                const isLow = min !== null && stock < min;

                return (
                  <tr className={`hover:bg-slate-50/80 transition ${isLow ? 'bg-rose-50/40' : ''}`} key={item.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-2">
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {item.name}
                          </span>
                          {item.code && (
                            <span className="font-mono text-[11px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {item.code}
                            </span>
                          )}
                          {item.note && (
                            <span className="text-[11px] text-slate-500 block mt-0.5 truncate max-w-[280px]" title={item.note}>
                              {item.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {item.category === 'CONSUMABLE' ? (
                        <span className="font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-block text-[11px]">
                          📦 Spotřební
                        </span>
                      ) : (
                        <span className="font-extrabold text-sky-900 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 inline-block text-[11px]">
                          🔨 Vratné nářadí
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`text-base font-black ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                        {stock} <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {min !== null ? (
                        <span className="font-bold text-slate-700">
                          {min} {item.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {item.location ? (
                        <span className="inline-flex items-center gap-1 text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          <MapPin size={12} className="text-slate-500" />
                          {item.location}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {item.supplierName ? (
                        <div>
                          <span className="font-bold text-slate-900 block">{item.supplierName}</span>
                          {item.supplierContact && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-[150px]" title={item.supplierContact}>
                              {item.supplierContact}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isLow && (
                          <RestockButton itemId={item.id} itemName={item.name} />
                        )}

                        <WarehouseMovementModal
                          itemId={item.id}
                          itemName={item.name}
                          unit={item.unit}
                          currentStock={stock}
                          category={item.category}
                          workOrders={workOrders}
                          employees={employees}
                        />

                        <WarehouseItemModal item={{
                          ...item,
                          quantityInStock: Number(item.quantityInStock),
                          minQuantity: item.minQuantity ? Number(item.minQuantity) : null,
                          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Audit Trail: Recent Warehouse Movements */}
      <section className="card">
        <h2 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 mb-4">
          📜 Poslední pohyby ve skladu
        </h2>

        {recentMovementsRaw.length === 0 ? (
          <p className="text-xs text-slate-500">Zatím nebyly zaznamenány žádné pohyby na skladě.</p>
        ) : (
          <div className="space-y-2.5 text-xs">
            {recentMovementsRaw.map((m) => {
              let badge = '📥 Příjem';
              let badgeStyle = 'bg-sky-50 text-sky-950 border-sky-200';
              if (m.type === 'ISSUE') {
                badge = '📤 Výdej';
                badgeStyle = 'bg-amber-50 text-amber-950 border-amber-200';
              } else if (m.type === 'RETURN') {
                badge = '🔄 Vrácení';
                badgeStyle = 'bg-emerald-50 text-emerald-950 border-emerald-200';
              } else if (m.type === 'ADJUSTMENT') {
                badge = '✏️ Inventura';
                badgeStyle = 'bg-purple-50 text-purple-950 border-purple-200';
              }

              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-extrabold px-2.5 py-1 rounded-lg border text-[11px] ${badgeStyle}`}>
                      {badge}
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-900">{m.item.name}</span>
                      <span className="font-black text-slate-900 ml-2">
                        ({Number(m.quantity)} {m.item.unit})
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Zaznamenal: <b>{m.performedByName}</b>
                        {m.assignedEmployeeName && ` · Předáno: ${m.assignedEmployeeName}`}
                        {m.workOrder && ` · Zakázka: ${m.workOrder.title}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      {new Date(m.createdAt).toLocaleString('cs-CZ')}
                    </span>
                    {m.note && <span className="text-[11px] text-slate-600 font-medium italic">{m.note}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
