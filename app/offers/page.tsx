import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { OfferBuilder } from '@/components/OfferBuilder';
import { StatusBadge } from '@/components/StatusBadge';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { getOffers, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Obchodni nabidky</h1>
          <p className="mt-1 text-sm text-slate-500">Nabidky propojuji klienta, reklamni plochy, termin, cenu a kontrolu kolizi.</p>
        </div>
        <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="/occupancy">Prehled obsazenosti</Link>
      </div>

      {clients.length > 0 && surfaces.length > 0 ? <OfferBuilder clients={clients} surfaces={surfaceOptions} /> : (
        <section className="card"><h2 className="text-xl font-bold">Nabidku zatim nelze vytvorit</h2><p className="mt-2 text-sm text-slate-500">Je potreba mit alespon jednoho klienta a jednu reklamni plochu.</p></section>
      )}

      <section className="card mt-6 overflow-x-auto">
        <h2 className="mb-3 text-xl font-bold">Posledni nabidky</h2>
        {offers.length === 0 ? <p className="text-sm text-slate-500">Zatim neni ulozena zadna nabidka.</p> : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Nabidka</th><th className="border-b py-2 pr-3">Klient</th><th className="border-b py-2 pr-3">Plochy</th><th className="border-b py-2 pr-3">Cena</th><th className="border-b py-2 pr-3">Platnost</th><th className="border-b py-2 pr-3">Stav</th></tr></thead>
            <tbody>{offers.map((offer) => (
              <tr className="border-b last:border-0" key={offer.id}>
                <td className="py-3 pr-3"><b>{offer.title}</b><br /><span className="text-slate-500">vytvoreno {new Date(offer.createdAt).toLocaleDateString('cs-CZ')}</span></td>
                <td className="py-3 pr-3">{offer.client?.name}</td>
                <td className="py-3 pr-3">{offer.items.slice(0, 3).map((item) => <div key={item.id}>{item.surface?.carrier?.code} - {item.surface?.name} - {item.surface ? mediaTypeLabel(item.surface.mediaType) : ''}</div>)}{offer.items.length > 3 && <span className="text-slate-500">+ {offer.items.length - 3} dalsi</span>}</td>
                <td className="py-3 pr-3">{offer.totalPrice?.toLocaleString('cs-CZ') ?? '-'} Kc</td>
                <td className="py-3 pr-3">{offer.validUntil ?? 'Neuvedena'}</td>
                <td className="py-3 pr-3"><StatusBadge value={offer.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
