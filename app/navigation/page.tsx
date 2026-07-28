import Link from 'next/link';
import {
  Compass,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  LayoutGrid,
  List,
  ArrowRight,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { PageHeader, StatCard, Button } from '@/components/ui';
import {
  listNavigationOrders,
  getNavigationDashboardStats,
  getNavigationAttentionAlerts,
} from '@/lib/navigation/navigation-service';
import {
  NAVIGATION_ORDER_STATUS_COLORS,
  NAVIGATION_ORDER_STATUS_LABELS,
  NAVIGATION_BLOCK_STATUS_LABELS,
} from '@/lib/navigation/types';
import { NavigationKanbanView } from '@/components/navigation/NavigationKanbanView';

export const dynamic = 'force-dynamic';

export default async function NavigationDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess('navigationProjects');
  const params = await searchParams;

  const query = typeof params.query === 'string' ? params.query : undefined;
  const status = typeof params.status === 'string' ? params.status : undefined;
  const blockStatus = typeof params.blockStatus === 'string' ? params.blockStatus : undefined;
  const quickFilter = typeof params.quickFilter === 'string' ? params.quickFilter : undefined;
  const view = typeof params.view === 'string' ? params.view : 'table';

  const [orders, stats, alerts] = await Promise.all([
    listNavigationOrders(user, { query, status, blockStatus, quickFilter }),
    getNavigationDashboardStats(user),
    getNavigationAttentionAlerts(user),
  ]);

  return (
    <AppShell>
      {/* Top Header & Operational Actions */}
      <PageHeader
        title="Modul NAVIGACE"
        description="Kompletní provozní rozhraní pro navigaci: od nabídky přes výrobu, plánování montáží v terénu až po fakturaci."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href="/offers/new/navigation" variant="primary">
              <Plus size={16} className="mr-1.5" /> Nová navigační nabídka
            </Button>
            <Button href="/navigation/installations/planning" variant="secondary">
              📅 Naplánovat montáže
            </Button>
            <Button href="/navigation/installations" variant="secondary">
              📱 Montážní rozhraní
            </Button>
            <Button href="/navigation?view=kanban" variant="ghost">
              <Layers size={16} className="mr-1.5" /> Workflow Kanban
            </Button>
          </div>
        }
      />

      {/* Module Sub-Navigation Bar */}
      <div className="mb-6 flex border-b border-slate-200 gap-6 overflow-x-auto pb-1 text-sm font-bold">
        <Link
          href="/navigation"
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all ${
            !status && !view ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📌 Přehled & Dashboard
        </Link>
        <Link
          href="/navigation?view=table"
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all ${
            view === 'table' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📋 Zakázky ({stats.totalCount})
        </Link>
        <Link
          href="/navigation?view=kanban"
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all ${
            view === 'kanban' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🗂️ Workflow Kanban
        </Link>
        <Link
          href="/navigation/installations"
          className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap"
        >
          📱 Mobilní Montáže
        </Link>
        <Link
          href="/navigation/contracts"
          className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap"
        >
          📄 Evidence smluv
        </Link>
        <Link
          href="/navigation/contacts"
          className="pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 whitespace-nowrap"
        >
          👥 Kontaktní osoby
        </Link>
        <Link
          href="/navigation?status=PRIPRAVENO_K_FAKTURACI"
          className={`pb-2.5 border-b-2 whitespace-nowrap transition-all ${
            status === 'PRIPRAVENO_K_FAKTURACI' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          💳 Fakturace ({stats.readyForBillingCount})
        </Link>
      </div>

      {/* Server Aggregated KPI Cards */}
      <div className="mb-6 grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <Link href="/navigation?quickFilter=ACTIVE" className="block">
          <StatCard icon={<Compass size={18} />} label="Aktivní zakázky" tone="blue" value={stats.activeCount} description="V procesu" />
        </Link>
        <Link href="/navigation?blockStatus=CEKA_NA_KLIENTA" className="block">
          <StatCard icon={<Clock size={18} />} label="Čeká na klienta" tone="orange" value={stats.waitingForClientCount} description="Potvrzení / Smlouva" />
        </Link>
        <Link href="/navigation?status=GRAFICKE_PODKLADY" className="block">
          <StatCard icon={<Layers size={18} />} label="Čeká na grafiku" tone="purple" value={stats.waitingForGraphicsCount} description="Grafika & Schválení" />
        </Link>
        <Link href="/navigation?status=TISK_VYROBA" className="block">
          <StatCard icon={<Clock size={18} />} label="Ve výrobě" tone="purple" value={stats.inProductionCount} description="Tisk & Kompletace" />
        </Link>
        <Link href="/navigation?status=PRIPRAVENO_K_INSTALACI" className="block">
          <StatCard icon={<Compass size={18} />} label="Připraveno m." tone="blue" value={stats.readyForInstallationCount} description="K výjezdu" />
        </Link>
        <Link href="/navigation?status=INSTALACE" className="block">
          <StatCard icon={<Clock size={18} />} label="Probíhá montáž" tone="orange" value={stats.installationInProgressCount} description="V terénu" />
        </Link>
        <Link href="/navigation?quickFilter=MISSING_PHOTOS" className="block">
          <StatCard icon={<AlertTriangle size={18} />} label="Chybí fotodokumentace" tone="orange" value={stats.missingPhotosCount} description="Nainstalováno bez fotek" />
        </Link>
        <Link href="/navigation?status=PRIPRAVENO_K_FAKTURACI" className="block">
          <StatCard icon={<CheckCircle2 size={18} />} label="K fakturaci" tone="green" value={stats.readyForBillingCount} description="Schválené podklady" />
        </Link>
      </div>

      {/* Attention Alerts Section */}
      {alerts.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" /> Vyžaduje pozornost ({alerts.length})
            </h2>
            <span className="text-xs font-semibold text-amber-700">Položky vyžadující reakci obchodníka nebo manažera</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900">{alert.orderNumber}</span>
                    <p className="text-xs text-slate-600 font-semibold">{alert.clientName}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {alert.waitingDaysOrDeadline}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{alert.reason}</p>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400 font-medium">Odpovědný: {alert.assignedUserName}</span>
                  <Link
                    href={alert.actionUrl}
                    className="font-bold text-sky-700 hover:underline flex items-center gap-1"
                  >
                    {alert.actionLabel} <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Bar & Quick Filters */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Rychlé filtry:</span>
            <Link
              href="/navigation?quickFilter=MY"
              className={`rounded-lg px-2.5 py-1 font-bold border transition-all ${
                quickFilter === 'MY'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Moje zakázky
            </Link>
            <Link
              href="/navigation?quickFilter=ACTIVE"
              className={`rounded-lg px-2.5 py-1 font-bold border transition-all ${
                quickFilter === 'ACTIVE'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Aktivní
            </Link>
            <Link
              href="/navigation?quickFilter=MISSING_PHOTOS"
              className={`rounded-lg px-2.5 py-1 font-bold border transition-all ${
                quickFilter === 'MISSING_PHOTOS'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Chybí fotky
            </Link>
            <Link
              href="/navigation?quickFilter=READY_BILLING"
              className={`rounded-lg px-2.5 py-1 font-bold border transition-all ${
                quickFilter === 'READY_BILLING'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              K fakturaci
            </Link>
            <Link
              href="/navigation?quickFilter=COMPLETED"
              className={`rounded-lg px-2.5 py-1 font-bold border transition-all ${
                quickFilter === 'COMPLETED'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Dokončené
            </Link>
            {(query || status || blockStatus || quickFilter) && (
              <Link href="/navigation" className="text-rose-600 hover:underline font-bold text-[11px] ml-2">
                ✕ Zrušit filtry
              </Link>
            )}
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <Link
              href={`/navigation?view=table${query ? `&query=${query}` : ''}${status ? `&status=${status}` : ''}`}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 ${
                view === 'table' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Tabulkový přehled"
            >
              <List size={15} /> Tabulka
            </Link>
            <Link
              href={`/navigation?view=cards${query ? `&query=${query}` : ''}${status ? `&status=${status}` : ''}`}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 ${
                view === 'cards' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Kartový přehled"
            >
              <LayoutGrid size={15} /> Karty
            </Link>
            <Link
              href={`/navigation?view=kanban${query ? `&query=${query}` : ''}${status ? `&status=${status}` : ''}`}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 ${
                view === 'kanban' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Workflow Kanban"
            >
              <Layers size={15} /> Kanban
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Area Based on Selected View */}
      {view === 'kanban' ? (
        <NavigationKanbanView initialOrders={orders} />
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((o) => {
            const statusColor = NAVIGATION_ORDER_STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-800';
            const statusLabel = NAVIGATION_ORDER_STATUS_LABELS[o.status] || o.status;
            const blockLabel = o.blockStatus ? NAVIGATION_BLOCK_STATUS_LABELS[o.blockStatus] : null;

            return (
              <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                      {o.orderNumber}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">{o.targetName}</h3>
                    <p className="text-xs text-slate-500">Klient: <b>{o.clientName}</b></p>
                  </div>
                  <span className="text-base font-black text-slate-900">{o.totalPrice.toLocaleString('cs-CZ')} Kč</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusColor}`}>
                    {statusLabel}
                  </span>
                  {blockLabel && (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      ⏳ {blockLabel}
                    </span>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>📍 {o.installedPointsCount} / {o.pointsCount} namontováno</span>
                  <span>📷 {o.photosCount} / {o.pointsCount} fotek</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <Link
                    href={`/navigation/orders/${o.id}`}
                    className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    Detail zakázky <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <section className="card !p-0">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-900">Seznam navigačních zakázek</h2>
            <span className="text-xs font-medium text-slate-500">Zobrazeno {orders.length} zakázek</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Compass size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-700 text-base">Žádné navigační zakázky neodpovídají filtrům</p>
              <p className="text-xs mt-1">Zkuste upravit nebo zrušit zadané filtry.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Číslo zakázky</th>
                    <th className="p-3.5">Klient</th>
                    <th className="p-3.5">Cíl navigace</th>
                    <th className="p-3.5">Body & Montáž</th>
                    <th className="p-3.5">Fotky</th>
                    <th className="p-3.5">Stav workflow</th>
                    <th className="p-3.5">Blokace</th>
                    <th className="p-3.5">Odpovědný</th>
                    <th className="p-3.5">Cena bez DPH</th>
                    <th className="p-3.5 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const statusColor = NAVIGATION_ORDER_STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-800';
                    const statusLabel = NAVIGATION_ORDER_STATUS_LABELS[o.status] || o.status;
                    const blockLabel = o.blockStatus ? NAVIGATION_BLOCK_STATUS_LABELS[o.blockStatus] : null;

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-all">
                        <td className="p-3.5">
                          <Link href={`/navigation/orders/${o.id}`} className="font-bold text-slate-900 hover:text-sky-700 hover:underline">
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-800">{o.clientName}</td>
                        <td className="p-3.5">
                          <b className="text-slate-900">{o.targetName}</b>
                          {o.targetAddress && <div className="text-[11px] text-slate-500">{o.targetAddress}</div>}
                        </td>
                        <td className="p-3.5 font-semibold">
                          {o.installedPointsCount} / {o.pointsCount} bodů
                        </td>
                        <td className="p-3.5 font-semibold">
                          {o.photosCount} / {o.pointsCount} fotek
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {blockLabel ? (
                            <span className="inline-flex items-center text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⏳ {blockLabel}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600 font-medium">{o.assignedUserName || 'Nepřiřazen'}</td>
                        <td className="p-3.5 font-bold text-slate-900">{o.totalPrice.toLocaleString('cs-CZ')} Kč</td>
                        <td className="p-3.5 text-right">
                          <Link
                            href={`/navigation/orders/${o.id}`}
                            className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                          >
                            Detail <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
