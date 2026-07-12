import { Archive, CalendarClock, CheckCircle2, Clock3, MapPinOff, PanelsTopLeft, PieChart, RadioTower, ShieldAlert, Tag } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { EmptyState, PageHeader, StatCard, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

function dateOnly(date: Date) {
  return date.toLocaleDateString('cs-CZ');
}

export default async function Dashboard() {
  await requirePageAccess('dashboard');
  const today = new Date();
  const in7 = new Date(today);
  in7.setDate(today.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);

  const [
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    missingGps,
    totalSurfaces,
    availableSurfaces,
    occupiedSurfaces,
    reservedSurfaces,
    ending30,
    waitingOffers,
    missingGpsRows,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null } } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'AVAILABLE' } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'OCCUPIED' } }),
    prisma.advertisingSurface.count({ where: { carrier: { archivedAt: null }, status: 'RESERVED' } }),
    prisma.occupancy.findMany({
      where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in30 } },
      include: { client: true, surface: { include: { carrier: true } } },
      orderBy: { dateTo: 'asc' },
      take: 10,
    }),
    prisma.offer.count({ where: { status: 'SENT' } }),
    prisma.advertisingCarrier.findMany({
      where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] },
      orderBy: [{ city: 'asc' }, { code: 'asc' }],
      take: 8,
      select: { id: true, code: true, name: true, city: true, street: true, address: true },
    }),
  ]);

  const occupancyPercent = Math.round((occupiedSurfaces / Math.max(totalSurfaces, 1)) * 100);
  const ending7 = ending30.filter((item) => item.dateTo <= in7);

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Rychlý přehled reklamních nosičů, obsazenosti, nabídek a datových problémů, které vyžadují pozornost."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard description="Všechny nosiče v databázi bez stránkovacího limitu." icon={<PanelsTopLeft size={20} />} label="Celkem nosičů" tone="slate" value={totalCarriers} />
        <StatCard description="Aktivní a nearchivované nosiče." icon={<RadioTower size={20} />} label="Aktivní nosiče" tone="green" value={activeCarriers} />
        <StatCard description="Plochy připravené pro nabídku." icon={<CheckCircle2 size={20} />} label="Volné plochy" tone="green" value={availableSurfaces} />
        <StatCard description="Aktuálně obsazené reklamní plochy." icon={<ShieldAlert size={20} />} label="Obsazené plochy" tone="red" value={occupiedSurfaces} />
        <StatCard description="Rezervované plochy." icon={<Clock3 size={20} />} label="Rezervace" tone="orange" value={reservedSurfaces} />
        <StatCard description="Podíl obsazených ploch z aktivních ploch." icon={<PieChart size={20} />} label="Obsazenost" tone="blue" value={`${occupancyPercent} %`} />
        <StatCard description="Aktivní nosiče bez kompletní GPS polohy." icon={<MapPinOff size={20} />} label="Bez GPS" tone="purple" value={missingGps} />
        <StatCard description="Archivované nosiče mimo běžný provoz." icon={<Archive size={20} />} label="Archivované" tone="zinc" value={archivedCarriers} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Kampaně končící do 7 dnů</h2>
              <p className="text-sm text-slate-500">{ending7.length} záznamů vyžaduje rychlou kontrolu.</p>
            </div>
            <CalendarClock className="text-orange-500" size={22} />
          </div>
          {ending7.length === 0 ? <EmptyState title="Žádné kampaně nekončí do 7 dnů." /> : (
            <Table minWidth="min-w-[620px]"><TableHead><tr><TableHeaderCell>Kampaň</TableHeaderCell><TableHeaderCell>Nosič</TableHeaderCell><TableHeaderCell>Do</TableHeaderCell><TableHeaderCell>Stav</TableHeaderCell></tr></TableHead><tbody>{ending7.map((item) => <tr key={item.id}><TableCell><b>{item.campaignName}</b><br /><span className="text-slate-500">{item.client?.name ?? item.clientName}</span></TableCell><TableCell>{item.surface.carrier.code}<br /><span className="text-slate-500">{item.surface.carrier.city}</span></TableCell><TableCell>{dateOnly(item.dateTo)}</TableCell><TableCell><StatusBadge value={item.status} /></TableCell></tr>)}</tbody></Table>
          )}
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Kampaně končící do 30 dnů</h2>
              <p className="text-sm text-slate-500">Plán prodloužení nebo uvolnění ploch.</p>
            </div>
            <Tag className="text-blue-500" size={22} />
          </div>
          {ending30.length === 0 ? <EmptyState title="Do 30 dnů nekončí žádná evidovaná kampaň." /> : (
            <Table minWidth="min-w-[620px]"><TableHead><tr><TableHeaderCell>Kampaň</TableHeaderCell><TableHeaderCell>Klient</TableHeaderCell><TableHeaderCell>Do</TableHeaderCell><TableHeaderCell>Stav</TableHeaderCell></tr></TableHead><tbody>{ending30.map((item) => <tr key={item.id}><TableCell>{item.campaignName}</TableCell><TableCell>{item.client?.name ?? item.clientName}</TableCell><TableCell>{dateOnly(item.dateTo)}</TableCell><TableCell><StatusBadge value={item.status} /></TableCell></tr>)}</tbody></Table>
          )}
        </section>

        <section className="card">
          <h2 className="text-xl font-semibold text-slate-950">Nabídky čekající na reakci</h2>
          <p className="mt-1 text-sm text-slate-500">Odeslané nabídky ve stavu SENT.</p>
          <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-blue-900 ring-1 ring-blue-100">
            <p className="text-4xl font-semibold">{waitingOffers}</p>
            <p className="mt-1 text-sm">nabídek čeká na reakci klienta</p>
          </div>
        </section>

        <section className="card">
          <h2 className="text-xl font-semibold text-slate-950">Nosiče bez GPS</h2>
          <p className="mt-1 text-sm text-slate-500">Tyto záznamy se neukážou jako marker na mapě.</p>
          {missingGpsRows.length === 0 ? <div className="mt-4"><EmptyState title="Všechny aktivní nosiče mají GPS." /></div> : (
            <div className="mt-4 space-y-2">{missingGpsRows.map((carrier) => <a className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`/carriers/${carrier.id}`} key={carrier.id}><span><b>{carrier.code}</b> · {carrier.name}<br /><span className="text-slate-500">{[carrier.city, carrier.street ?? carrier.address].filter(Boolean).join(' · ')}</span></span><StatusBadge value="MISSING" /></a>)}</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
