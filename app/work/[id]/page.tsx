import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { WorkOrderActions } from '@/components/WorkOrderActions';
import { prisma } from '@/lib/db';
import { formatWorkDate, formatWorkPrice, workPriorityLabels, workPriorityStyles, workStatusLabels, workStatusStyles, workTypeLabels } from '@/lib/work';

export const dynamic = 'force-dynamic';

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const order = await prisma.workOrder.findUnique({
    where: { id: (await params).id },
    include: { client: true, assignments: true, items: { include: { carrier: true, surface: true } } },
  });
  if (!order) notFound();
  const isOverdue = Boolean(order.deadlineAt && order.deadlineAt < new Date() && !['DONE', 'CANCELLED'].includes(order.status));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link className="text-sm font-medium text-sky-700 hover:text-sky-900" href="/work">← Zpět na plán práce</Link>
        <header className={`card ${isOverdue ? 'border-red-400 ring-2 ring-red-100' : ''}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workStatusStyles[order.status]}`}>{workStatusLabels[order.status]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${workPriorityStyles[order.priority]}`}>{workPriorityLabels[order.priority]}</span>{isOverdue && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Po termínu</span>}<span className="text-sm text-slate-500">{workTypeLabels[order.workType]}</span></div><h1 className="mt-3 text-3xl font-bold">{order.title}</h1><p className="mt-2 text-slate-600">{order.client?.name || order.clientName}</p><p className="mt-1 text-sm font-medium text-slate-500">Zadal/a: {order.requestedBy || 'Neuvedeno'}</p></div>
            <div className="space-y-2 text-right"><div className="rounded-xl bg-slate-100 px-4 py-3"><p className="text-xs uppercase tracking-wide text-slate-500">Datum práce</p><strong>{formatWorkDate(order.scheduledAt)}</strong></div><p className="text-lg font-bold">{formatWorkPrice(order.price?.toString())}</p></div>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="card"><h2 className="text-lg font-bold">Zadání</h2><p className="mt-3 whitespace-pre-wrap text-slate-700">{order.description}</p>{order.locationNote && <div className="mt-4 rounded-xl bg-amber-50 p-4"><strong>Místo a pokyny</strong><p className="mt-1 text-sm text-amber-950">{order.locationNote}</p></div>}</section>
            <section className="card"><h2 className="text-lg font-bold">Nosiče a média</h2>{order.items.length === 0 ? <p className="mt-2 text-sm text-slate-500">Úkol není spojený s konkrétním nosičem.</p> : <div className="mt-3 space-y-3">{order.items.map((item) => <div className="rounded-xl border border-slate-200 p-3" key={item.id}><p className="font-medium">{item.carrier?.name || item.surface?.name || item.description || 'Položka práce'}</p><p className="text-sm text-slate-500">{item.carrier ? `${item.carrier.code} · ${item.carrier.city}` : ''} · {item.quantity} ks</p>{item.carrier && <div className="mt-2 flex gap-4 text-sm"><Link className="text-sky-700" href={`/carriers/${item.carrier.id}`}>Detail nosiče</Link>{item.carrier.latitude !== null && item.carrier.longitude !== null && <Link className="text-sky-700" href={`/map?carrier=${item.carrier.id}`}>Zobrazit na mapě</Link>}</div>}</div>)}</div>} {order.mediaLabel && <p className="mt-3 text-sm"><strong>Typ média:</strong> {order.mediaLabel}{order.quantity ? ` · ${order.quantity} ks` : ''}</p>}</section>
            <section className="card"><h2 className="text-lg font-bold">Termíny a podklady</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs uppercase text-slate-500">Dokončit do</dt><dd className={isOverdue ? 'font-semibold text-red-700' : ''}>{order.deadlineAt ? formatWorkDate(order.deadlineAt) : 'Neuvedeno'}</dd></div><div><dt className="text-xs uppercase text-slate-500">Platnost kampaně</dt><dd>{order.campaignDateFrom ? `${formatWorkDate(order.campaignDateFrom)} – ${order.campaignDateTo ? formatWorkDate(order.campaignDateTo) : 'bez konce'}` : 'Neuvedeno'}</dd></div></dl><div className="mt-4 flex flex-wrap gap-4">{order.ftdUrl && <a className="text-sm font-semibold text-emerald-700" href={order.ftdUrl} rel="noreferrer" target="_blank">Otevřít fotodokumentaci na Disku ↗</a>}{order.referenceUrl && <a className="text-sm font-medium text-sky-700" href={order.referenceUrl} rel="noreferrer" target="_blank">Otevřít podklady ↗</a>}</div>{!order.ftdUrl && <p className="mt-4 text-sm text-slate-500">Složka fotodokumentace zatím není připojena.</p>}</section>
          </div>
          <aside className="space-y-6">
            <WorkOrderActions id={order.id} status={order.status} priority={order.priority} price={order.price?.toString() ?? null} ftdSent={order.ftdSent} invoiced={order.invoiced} requestedBy={order.requestedBy} />
            <section className="card"><h2 className="text-lg font-bold">Zadavatel</h2><p className="mt-2 text-sm">{order.requestedBy || 'Neuveden'}</p><p className="mt-1 text-xs text-slate-500">Zadavatel určuje prioritu a cenu a po potvrzení fotodokumentace vystavuje fakturu.</p></section>
            <section className="card"><h2 className="text-lg font-bold">Pracovníci</h2><p className="mt-2 text-sm">{order.assignments.map((assignment) => assignment.workerName).join(', ') || 'Zatím nepřiřazeni'}</p><p className="mt-1 text-xs text-slate-500">Pracovník potvrzuje nahrání fotodokumentace.</p></section>
            <section className="card"><h2 className="text-lg font-bold">Kontakt na místě</h2><p className="mt-2 text-sm">{order.contactName || 'Neuveden'}</p>{order.contactPhone && <a className="mt-1 block text-sm font-medium text-sky-700" href={`tel:${order.contactPhone}`}>{order.contactPhone}</a>}</section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
