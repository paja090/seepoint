import Link from 'next/link';
import { CheckCircle2, FileClock, FileText, Send, XCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { OfferBuilder } from '@/components/OfferBuilder';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, EmptyState, PageHeader, StatCard, Table, TableCell, TableHead, TableHeaderCell, Tabs } from '@/components/ui';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { getOffers, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  await requirePageAccess('offers');
  const [clients, surfaces, offers] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      include: { carrier: true },
      orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }, { name: 'asc' }],
      take: 1000,
    }),
    getOffers(),
  ]);

  const statusCounts = offers.reduce<Record<string, number>>((acc, offer) => {
    acc[offer.status] = (acc[offer.status] ?? 0) + 1;
    return acc;
  }, {});

  const surfaceOptions = surfaces.map((surface) => ({
    id: surface.id,
    name: surface.name,
    mediaType: surface.mediaType,
    status: surface.status,
    price: surface.price?.toNumber(),
    carrier: { code: surface.carrier.code, name: surface.carrier.name, city: surface.carrier.city },
  }));

  return (
    <AppShell>
      <PageHeader
        title="Obchodní nabídky"
        description="Nabídky propojují klienta, reklamní plochy, termín, cenu a kontrolu kolizí s obsazeností."
        actions={<Button href="/occupancy" variant="secondary">Přehled obsazenosti</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<FileText size={20} />} label="Draft" tone="slate" value={statusCounts.DRAFT ?? 0} />
        <StatCard icon={<Send size={20} />} label="Odeslané" tone="blue" value={statusCounts.SENT ?? 0} />
        <StatCard icon={<CheckCircle2 size={20} />} label="Schválené" tone="green" value={statusCounts.ACCEPTED ?? 0} />
        <StatCard icon={<XCircle size={20} />} label="Zamítnuté" tone="red" value={statusCounts.REJECTED ?? 0} />
        <StatCard icon={<FileClock size={20} />} label="Expirované" tone="zinc" value={statusCounts.EXPIRED ?? 0} />
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Vytvoření nabídky</h2>
            <p className="mt-1 text-sm text-slate-500">Zjednodušený wizard: klient → plochy → termín → kontrola kolizí → uložení draftu.</p>
          </div>
          <Tabs items={['Klient', 'Plochy', 'Termín', 'Kontrola', 'Uložit']} />
        </div>
        {clients.length > 0 && surfaces.length > 0 ? <OfferBuilder clients={clients} surfaces={surfaceOptions} /> : (
          <EmptyState title="Nabídku zatím nelze vytvořit." description="Je potřeba mít alespoň jednoho klienta a jednu reklamní plochu." />
        )}
      </Card>

      <section className="card mt-6 !p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Přehled nabídek</h2>
            <p className="text-sm text-slate-500">Posledních {offers.length} uložených nabídek.</p>
          </div>
        </div>
        {offers.length === 0 ? <div className="p-5"><EmptyState title="Zatím není uložená žádná nabídka." /></div> : (
          <Table minWidth="min-w-[980px]">
            <TableHead><tr><TableHeaderCell>Klient</TableHeaderCell><TableHeaderCell>Název nabídky</TableHeaderCell><TableHeaderCell>Platnost</TableHeaderCell><TableHeaderCell>Cena</TableHeaderCell><TableHeaderCell>Stav</TableHeaderCell><TableHeaderCell>Počet ploch</TableHeaderCell><TableHeaderCell>Akce</TableHeaderCell></tr></TableHead>
            <tbody>{offers.map((offer) => (
              <tr className="hover:bg-slate-50/60" key={offer.id}>
                <TableCell>{offer.client?.name}</TableCell>
                <TableCell><b>{offer.title}</b><br /><span className="text-slate-500">vytvořeno {new Date(offer.createdAt).toLocaleDateString('cs-CZ')}</span></TableCell>
                <TableCell>{offer.validUntil ?? 'Neuvedena'}</TableCell>
                <TableCell>{offer.totalPrice?.toLocaleString('cs-CZ') ?? '-'} Kč</TableCell>
                <TableCell><StatusBadge value={offer.status} /></TableCell>
                <TableCell>{offer.items.length}<div className="mt-1 text-xs text-slate-500">{offer.items.slice(0, 2).map((item) => <div key={item.id}>{item.surface?.carrier?.code} · {item.surface ? mediaTypeLabel(item.surface.mediaType) : ''}</div>)}</div></TableCell>
                <TableCell><Link className="table-action" href="/offers">Detail</Link></TableCell>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
