import { ArrowUpRight, Clock, Eye, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { OfferView } from '@/lib/offers/view-model';

const stages = [
  { key: 'DRAFT', label: 'Koncepty', description: 'Rozpracované nabídky', tone: 'bg-amber-500' },
  { key: 'SENT', label: 'Odeslané', description: 'Zatím bez zobrazení', tone: 'bg-sky-500' },
  { key: 'VIEWED', label: 'Zobrazené', description: 'Klient otevřel nabídku', tone: 'bg-indigo-500' },
  { key: 'ACCEPTED', label: 'Přijaté', description: 'Schválené klientem', tone: 'bg-emerald-500' },
  { key: 'REJECTED', label: 'Odmítnuté', description: 'Odmítnuté klientem', tone: 'bg-red-500' },
  { key: 'EXPIRED', label: 'Expirované', description: 'Po datu platnosti', tone: 'bg-slate-400' },
] as const;

const money = (value: string | null) => new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export function OfferPipeline({ offers }: { offers: OfferView[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-6 gap-4">
        {stages.map((stage) => {
          const rows = offers.filter((offer) => stage.key === 'VIEWED'
            ? offer.status === 'SENT' && offer.events?.some((event) => event.type === 'VIEWED')
            : stage.key === 'SENT'
              ? offer.status === 'SENT' && !offer.events?.some((event) => event.type === 'VIEWED')
              : offer.status === stage.key);
          const total = rows.reduce((sum, offer) => sum + Number(offer.totalWithTax ?? 0), 0);

          return (
            <section className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-slate-50/60" key={stage.key}>
              <header className="border-b border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${stage.tone}`} />
                  <h3 className="text-sm font-semibold text-slate-950">{stage.label}</h3>
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {rows.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{stage.description}</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-700">{money(total.toFixed(2))}</p>
              </header>

              <div className="flex flex-1 flex-col gap-2.5 p-3">
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">Žádné položky</p>
                ) : rows.map((offer) => {
                  const validDays = offer.validUntil
                    ? Math.ceil((new Date(`${offer.validUntil}T23:59:59Z`).getTime() - Date.now()) / 86_400_000)
                    : null;
                  const viewCount = offer.events?.filter((event) => event.type === 'VIEWED').length ?? 0;
                  const initials = offer.createdBy.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2);

                  return (
                    <Link className="group block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md" href={`/offers/${offer.id}`} key={offer.id}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight text-slate-950">{offer.client.name}</p>
                        <ArrowUpRight aria-hidden="true" className="shrink-0 text-slate-300 transition group-hover:text-slate-600" size={14} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">{offer.campaignName}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold tracking-tight text-slate-950">{money(offer.totalWithTax)}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={12} />{offer.items.length} ploch</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">{initials}</span>
                          {new Date(offer.updatedAt).toLocaleDateString('cs-CZ')}
                        </span>
                        <span className="flex items-center gap-2">
                          {viewCount > 0 && <span className="inline-flex items-center gap-1 text-indigo-600"><Eye aria-hidden="true" size={12} />{viewCount}×</span>}
                          {validDays != null && ['SENT', 'VIEWED'].includes(stage.key) && (
                            <span className={`inline-flex items-center gap-1 ${validDays <= 5 ? 'text-red-600' : ''}`}>
                              <Clock aria-hidden="true" size={12} />{Math.max(0, validDays)} dní
                            </span>
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
