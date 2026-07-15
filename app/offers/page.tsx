import Link from 'next/link';
import { CheckCircle2, FileClock, FileText, Plus, Search, Send, XCircle } from 'lucide-react';
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

  return <AppShell>
    <PageHeader title="Obchodní nabídky" description="Nabídky od výběru klienta a ploch až po veřejnou prezentaci a převod na obsazenost." actions={<Button href="/offers/new"><Plus size={17} /> Nová nabídka</Button>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard icon={<FileText size={20} />} label="Koncepty" value={counts.DRAFT ?? 0} />
      <StatCard icon={<Send size={20} />} label="Odeslané" value={counts.SENT ?? 0} tone="blue" />
      <StatCard icon={<CheckCircle2 size={20} />} label="Přijaté" value={counts.ACCEPTED ?? 0} tone="green" />
      <StatCard icon={<XCircle size={20} />} label="Odmítnuté" value={counts.REJECTED ?? 0} tone="red" />
      <StatCard icon={<FileClock size={20} />} label="Expirované" value={counts.EXPIRED ?? 0} tone="zinc" />
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
    <section className="card !p-0">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-xl font-semibold">Tabulkový přehled</h2><p className="text-sm text-slate-500">Nalezeno {rows.length} nabídek.</p></div></div>
      {rows.length === 0 ? <div className="p-5"><EmptyState action={<Button href="/offers/new">Vytvořit nabídku</Button>} title="Žádná nabídka neodpovídá filtru." /></div> : <Table minWidth="min-w-[1100px]"><TableHead><tr><TableHeaderCell>Klient / kampaň</TableHeaderCell><TableHeaderCell>Obchodník</TableHeaderCell><TableHeaderCell>Platnost</TableHeaderCell><TableHeaderCell>Plochy</TableHeaderCell><TableHeaderCell>Cena s DPH</TableHeaderCell><TableHeaderCell>Stav</TableHeaderCell><TableHeaderCell>Akce</TableHeaderCell></tr></TableHead><tbody>{rows.map((offer) => <tr className="hover:bg-slate-50" key={offer.id}><TableCell><b>{offer.client.name}</b><br /><span className="text-slate-500">{offer.campaignName}</span></TableCell><TableCell>{offer.createdBy.name}</TableCell><TableCell>{offer.validUntil ? new Date(`${offer.validUntil}T00:00:00Z`).toLocaleDateString('cs-CZ') : 'Neuvedena'}</TableCell><TableCell>{offer.items.length}<div className="mt-1 text-xs text-slate-500">{[...new Set(offer.items.map((item) => item.groupLabel))].slice(0, 3).join(' · ')}</div></TableCell><TableCell><b>{money(offer.totalWithTax)}</b></TableCell><TableCell><StatusBadge value={offer.status as never} /></TableCell><TableCell><Link className="table-action" href={`/offers/${offer.id}`}>Detail</Link></TableCell></tr>)}</tbody></Table>}
    </section>
  </AppShell>;
}
