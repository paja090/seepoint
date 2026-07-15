import Link from 'next/link';
import { CalendarClock, CheckCircle2, Eye, Inbox, MessageSquare, Plus, Search, Send, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { OfferPipeline } from '@/components/offers/OfferPipeline';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, EmptyState, PageHeader, StatCard, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { prisma } from '@/lib/db';
import { listOffers } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';
const money = (value: string | null) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(Number(value ?? 0));
const mediaTypes = ['NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'];

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess('offers');
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, param]) => { if (typeof param === 'string' && param) urlParams.set(key, param); });
  let rows: OfferView[];
  let clients: Array<{ id: string; name: string }>;
  let salespeople: Array<{ id: string; name: string }>;
  try {
    [rows, clients, salespeople] = await Promise.all([
      listOffers(user, urlParams) as Promise<OfferView[]>,
      prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      user.role === 'SALES' ? [] : prisma.user.findMany({ where: { role: { in: ['ADMIN', 'MANAGER', 'SALES'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
  } catch (error) {
    console.error('Offers page load failed', { userId: user.id, role: user.role }, error);
    throw error;
  }
  const counts = rows.reduce<Record<string, number>>((acc, offer) => ({ ...acc, [offer.status]: (acc[offer.status] ?? 0) + 1 }), {});
  const pipelineValue = rows.filter((offer) => !['REJECTED', 'EXPIRED'].includes(offer.status)).reduce((sum, offer) => sum + Number(offer.totalWithTax ?? 0), 0);
  const viewed = rows.filter((offer) => offer.events?.some((event) => event.type === 'VIEWED')).length;
  const acceptedValue = rows.filter((offer) => offer.status === 'ACCEPTED').reduce((sum, offer) => sum + Number(offer.totalWithTax ?? 0), 0);
  const upcoming = rows.filter((offer) => offer.validUntil && new Date(`${offer.validUntil}T23:59:59Z`) >= new Date()).sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil))).slice(0, 5);
  const activity = rows.flatMap((offer) => (offer.events ?? []).map((event) => ({ ...event, offer }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return <AppShell>
    <PageHeader title="Obchodní nabídky" description="Nabídky od výběru klienta a ploch až po veřejnou prezentaci a převod na obsazenost." actions={<Button href="/offers/new"><Plus size={17} /> Nová nabídka</Button>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard description={`${rows.length} nabídek v aktuálním výběru`} icon={<TrendingUp size={20} />} label="Hodnota pipeline" tone="blue" value={money(pipelineValue.toFixed(2))} />
      <StatCard description="Čekají na dopracování" icon={<Inbox size={20} />} label="Koncepty" tone="orange" value={counts.DRAFT ?? 0} />
      <StatCard description={`${viewed} již zobrazených`} icon={<Send size={20} />} label="U klienta" tone="purple" value={counts.SENT ?? 0} />
      <StatCard description={`${money(acceptedValue.toFixed(2))} k převodu`} icon={<CheckCircle2 size={20} />} label="Schválené nabídky" tone="green" value={counts.ACCEPTED ?? 0} />
    </div>
    <Card className="mb-6">
      <form action="/offers">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_190px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input className="input pl-10" defaultValue={value('q')} name="q" placeholder="Nabídka, kampaň nebo klient" /></label>
          <select className="input" defaultValue={value('clientId')} name="clientId"><option value="">Všichni klienti</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          <select className="input" defaultValue={value('status')} name="status"><option value="">Všechny stavy</option><option value="DRAFT">Koncept</option><option value="SENT">Odeslaná</option><option value="ACCEPTED">Přijatá</option><option value="REJECTED">Odmítnutá</option><option value="EXPIRED">Expirovaná</option></select>
          <select className="input" defaultValue={value('createdByUserId')} disabled={user.role === 'SALES'} name="createdByUserId"><option value="">Všichni obchodníci</option>{salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
          <button className="btn-primary" type="submit">Filtrovat</button>
        </div>
        <details className="mt-4 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Rozšířené filtry</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select className="input" defaultValue={value('mediaType')} name="mediaType"><option value="">Všechna média</option>{mediaTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <input className="input" defaultValue={value('minPrice')} min="0" name="minPrice" placeholder="Cena s DPH od" step="0.01" type="number" />
            <input className="input" defaultValue={value('maxPrice')} min="0" name="maxPrice" placeholder="Cena s DPH do" step="0.01" type="number" />
            <span />
            {[['createdFrom', 'Vytvořeno od'], ['createdTo', 'Vytvořeno do'], ['validFrom', 'Platnost od'], ['validTo', 'Platnost do']].map(([name, label]) => <label className="text-xs text-slate-500" key={name}>{label}<input className="input mt-1" defaultValue={value(name)} name={name} type="date" /></label>)}
          </div>
        </details>
      </form>
    </Card>
    <OfferPipeline offers={rows} />
    <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="!p-0"><div className="border-b border-slate-100 p-5"><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><CalendarClock className="text-amber-600" size={18} /> Blížící se konce platnosti</h2><p className="mt-0.5 text-sm text-slate-500">Nabídky vhodné k připomenutí nebo aktualizaci.</p></div><ul className="divide-y divide-slate-100">{upcoming.length === 0 ? <li className="p-5 text-sm text-slate-500">Žádné blížící se termíny.</li> : upcoming.map((offer) => { const days = Math.max(0, Math.ceil((new Date(`${offer.validUntil}T23:59:59Z`).getTime() - Date.now()) / 86_400_000)); return <li className="flex items-center justify-between gap-4 p-4" key={offer.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-950">{offer.client.name}</p><p className="truncate text-xs text-slate-500">{offer.campaignName} · {offer.items.length} ploch</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="text-xs text-slate-500">Platnost do {new Date(`${offer.validUntil}T00:00:00Z`).toLocaleDateString('cs-CZ')}</p><p className="text-sm font-semibold text-slate-800">{money(offer.totalWithTax)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${days <= 5 ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{days} dní</span><Link className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700" href={`/offers/${offer.id}/edit`}>Upravit</Link></div></li>; })}</ul></Card>
      <Card className="!p-0"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-semibold text-slate-950">Poslední aktivita</h2><p className="mt-0.5 text-sm text-slate-500">Skutečné události nabídek a klientů.</p></div><ul className="divide-y divide-slate-100">{activity.length === 0 ? <li className="p-5 text-sm text-slate-500">Zatím bez aktivity.</li> : activity.map((item) => <li className="flex items-start gap-3 p-4" key={item.id}><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50 text-sky-700 ring-1 ring-slate-200">{item.type === 'VIEWED' ? <Eye size={15} /> : item.type === 'QUESTION' ? <MessageSquare size={15} /> : <CheckCircle2 size={15} />}</span><div className="min-w-0"><Link className="text-sm font-medium text-slate-800 hover:text-sky-700" href={`/offers/${item.offer.id}`}>{item.offer.client.name} · {item.offer.campaignName}</Link><p className="mt-0.5 text-xs text-slate-500">{item.type} · {item.actorName || 'Systém'} · {new Date(item.createdAt).toLocaleString('cs-CZ')}</p></div></li>)}</ul></Card>
    </div>
    <section className="card !p-0">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-xl font-semibold">Tabulkový přehled</h2><p className="text-sm text-slate-500">Nalezeno {rows.length} nabídek.</p></div></div>
      {rows.length === 0 ? <div className="p-5"><EmptyState action={<Button href="/offers/new">Vytvořit nabídku</Button>} title="Žádná nabídka neodpovídá filtru." /></div> : <Table minWidth="min-w-[1100px]"><TableHead><tr><TableHeaderCell>Klient / kampaň</TableHeaderCell><TableHeaderCell>Obchodník</TableHeaderCell><TableHeaderCell>Platnost</TableHeaderCell><TableHeaderCell>Plochy</TableHeaderCell><TableHeaderCell>Cena s DPH</TableHeaderCell><TableHeaderCell>Stav</TableHeaderCell><TableHeaderCell>Akce</TableHeaderCell></tr></TableHead><tbody>{rows.map((offer) => <tr className="hover:bg-slate-50" key={offer.id}><TableCell><b>{offer.client.name}</b><br /><span className="text-slate-500">{offer.campaignName}</span></TableCell><TableCell>{offer.createdBy.name}</TableCell><TableCell>{offer.validUntil ? new Date(`${offer.validUntil}T00:00:00Z`).toLocaleDateString('cs-CZ') : 'Neuvedena'}</TableCell><TableCell>{offer.items.length}<div className="mt-1 text-xs text-slate-500">{[...new Set(offer.items.map((item) => item.groupLabel))].slice(0, 3).join(' · ')}</div></TableCell><TableCell><b>{money(offer.totalWithTax)}</b></TableCell><TableCell><StatusBadge value={offer.status as never} /></TableCell><TableCell><Link className="table-action" href={`/offers/${offer.id}`}>Detail</Link></TableCell></tr>)}</tbody></Table>}
    </section>
  </AppShell>;
}
