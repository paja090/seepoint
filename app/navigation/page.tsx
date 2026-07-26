import Link from 'next/link';
import { Compass, Plus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { PageHeader, StatCard, Table, TableHead, TableHeaderCell, TableCell, Button } from '@/components/ui';
import { listNavigationOrders } from '@/lib/navigation/navigation-service';
import { NAVIGATION_ORDER_STATUS_COLORS, NAVIGATION_ORDER_STATUS_LABELS, NAVIGATION_BLOCK_STATUS_LABELS } from '@/lib/navigation/types';

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

  const orders = await listNavigationOrders(user, { query, status });

  const totalCount = orders.length;
  const activeCount = orders.filter((o) => ['INSTALACE', 'PRIPRAVENO_K_INSTALACI', 'TISK_VYROBA'].includes(o.status)).length;
  const waitingForPhotosCount = orders.filter((o) => o.status === 'INSTALACE' || o.blockStatus === 'CEKA_NA_FOTOGRAFIE').length;
  const readyForBillingCount = orders.filter((o) => o.status === 'PRIPRAVENO_K_FAKTURACI').length;

  return (
    <AppShell>
      <PageHeader
        title="Modul NAVIGACE"
        description="Kompletní přehled navigačních zakázek, workflow montáží, fotodokumentace a fakturace."
        actions={
          <div className="flex gap-2">
            <Button href="/navigation/installations" variant="secondary">
              📱 Montážní rozhraní
            </Button>
            <Button href="/offers/new/navigation" variant="primary">
              <Plus size={16} className="mr-2" /> Nová navigační nabídka
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Compass size={20} />} label="Celkem zakázek" tone="blue" value={totalCount} description="Navigační zakázky v systému" />
        <StatCard icon={<Clock size={20} />} label="V realizaci / výrobě" tone="purple" value={activeCount} description="Výroba, tisk a probíhající montáže" />
        <StatCard icon={<AlertTriangle size={20} />} label="Čeká na fotky" tone="amber" value={waitingForPhotosCount} description="Nainstalováno, chybí fotky z terénu" />
        <StatCard icon={<CheckCircle2 size={20} />} label="K fakturaci" tone="green" value={readyForBillingCount} description="Připraveno k vystavení faktury" />
      </div>

      <section className="card !p-0">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Seznam navigačních zakázek</h2>
          <span className="text-xs font-medium text-slate-500">Zobrazeno {orders.length} zakázek</span>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Compass size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">Žádné navigační zakázky</p>
            <p className="text-sm">Vytvořte novou nabídku a převeďte ji do zakázky.</p>
          </div>
        ) : (
          <Table minWidth="min-w-[1000px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Číslo zakázky</TableHeaderCell>
                <TableHeaderCell>Klient</TableHeaderCell>
                <TableHeaderCell>Cíl navigace</TableHeaderCell>
                <TableHeaderCell>Počet bodů</TableHeaderCell>
                <TableHeaderCell>Stav workflow</TableHeaderCell>
                <TableHeaderCell>Blokace / Čekání</TableHeaderCell>
                <TableHeaderCell>Cena bez DPH</TableHeaderCell>
                <TableHeaderCell>Akce</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {orders.map((order) => {
                const statusColor = NAVIGATION_ORDER_STATUS_COLORS[order.status as keyof typeof NAVIGATION_ORDER_STATUS_COLORS] || 'bg-slate-100 text-slate-800';
                const statusLabel = NAVIGATION_ORDER_STATUS_LABELS[order.status as keyof typeof NAVIGATION_ORDER_STATUS_LABELS] || order.status;
                const blockLabel = order.blockStatus ? NAVIGATION_BLOCK_STATUS_LABELS[order.blockStatus as keyof typeof NAVIGATION_BLOCK_STATUS_LABELS] : null;

                return (
                  <tr className="hover:bg-slate-50/60" key={order.id}>
                    <TableCell>
                      <Link className="font-bold text-slate-900 hover:underline" href={`/navigation/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-800">{order.clientName}</span>
                    </TableCell>
                    <TableCell>
                      <b>{order.targetName}</b>
                      {order.targetAddress && <div className="text-xs text-slate-500">{order.targetAddress}</div>}
                    </TableCell>
                    <TableCell>{order.pointsCount} ks</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      {blockLabel ? (
                        <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ⏳ {blockLabel}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{order.totalPrice.toLocaleString('cs-CZ')} Kč</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link className="table-action" href={`/navigation/orders/${order.id}`}>
                          Detail
                        </Link>
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
