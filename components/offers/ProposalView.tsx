import Image from 'next/image';
import { CalendarDays, CheckCircle2, MapPin, MonitorUp, ReceiptText } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import { OfferMap } from './OfferMap';

const money = (value: string | null | undefined, currency = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('cs-CZ').format(new Date(`${value}T00:00:00Z`)) : 'neuvedeno';
const mediaLabel = (value: string) => ({ CITY_POSTER: 'City Poster', PROMO_BENCH: 'Promo lavičky', NAVIGATION_SIGN: 'Navigace', CITYLIGHT: 'CLV', PROMO_TOWER: 'Promo Tower', PROMO_MINITOWER: 'Promo Minitower', LED_SCREEN: 'LED obrazovky', BILLBOARD: 'Billboardy', BIGBOARD: 'Bigboardy', BANNER: 'Bannery', FACADE: 'Fasády', PROMO_HORIZON: 'Promo Horizon', OTHER: 'Další média' }[value] ?? value);

export function ProposalView({ offer, publicView = false }: { offer: OfferView; publicView?: boolean }) {
  const cities = [...new Set(offer.items.map((item) => item.surface.carrier.city))];
  const groups = Object.entries(offer.items.reduce<Record<string, typeof offer.items>>((acc, item) => { const key = item.groupLabel || item.surface.mediaType; (acc[key] ??= []).push(item); return acc; }, {}));
  const points = offer.items.map((item) => ({ code: item.surface.carrier.code, city: item.surface.carrier.city, latitude: item.surface.carrier.latitude, longitude: item.surface.carrier.longitude }));
  return (
    <article className={publicView ? 'min-h-screen bg-slate-50 text-slate-950' : 'overflow-hidden rounded-3xl border border-slate-200 bg-white'}>
      <header className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white md:px-12 md:py-14">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 flex items-center justify-between gap-4">
            <Image src="/seepoint-logo.svg" alt="SeePOINT" width={164} height={48} className="h-10 w-auto brightness-0 invert" priority />
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">Reklamní nabídka</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">{offer.client.name}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">{offer.campaignName}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{offer.clientMessage || 'Promyšlený mediální mix na viditelných místech, připravený pro váš cíl a termín kampaně.'}</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><CalendarDays className="mb-3 text-emerald-300" /><b>{date(offer.items[0]?.dateFrom)} – {date(offer.items[0]?.dateTo)}</b><p className="mt-1 text-sm text-slate-400">období kampaně</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><MonitorUp className="mb-3 text-emerald-300" /><b>{offer.items.length} reklamních ploch</b><p className="mt-1 text-sm text-slate-400">v {cities.length} lokalitách</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ReceiptText className="mb-3 text-emerald-300" /><b>{money(offer.totalWithTax, offer.currency)}</b><p className="mt-1 text-sm text-slate-400">celkem včetně DPH</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-16 px-6 py-12 md:px-12 md:py-16">
        {offer.campaignGoal && <section><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Proč tato kampaň</p><h2 className="mt-3 text-3xl font-semibold">Strategie postavená na vašem cíli</h2><p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">{offer.campaignGoal}</p></section>}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Lokality</p><h2 className="mt-3 text-3xl font-semibold">Kampaň na mapě</h2></div><p className="text-sm text-slate-500">{cities.join(' · ')}</p></div>
          <OfferMap points={points} />
        </section>
        <section className="space-y-12">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Vybrané nosiče</p><h2 className="mt-3 text-3xl font-semibold">Mediální mix kampaně</h2></div>
          {groups.map(([group, items]) => <div key={group}>
            <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3"><h3 className="text-xl font-semibold">{mediaLabel(group)}</h3><span className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'plocha' : 'ploch'} · {money(items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0).toFixed(2), offer.currency)}</span></div>
            <div className="grid gap-5 md:grid-cols-2">{items.map((item, index) => {
              const photo = item.surface.photos[0];
              return <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" key={`${item.surface.carrier.code}-${index}`}>
                {photo ? <Image src={photo.url} alt={photo.note || `Nosič ${item.surface.carrier.code}`} width={900} height={560} className="h-56 w-full object-cover" /> : <div className="grid h-56 place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-500">Fotografie není označena pro klientské zobrazení</div>}
                <div className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs font-semibold text-emerald-700">{item.surface.carrier.code}</p><h4 className="mt-1 text-xl font-semibold">{item.customTitle || item.surface.carrier.name}</h4></div><b>{money(item.subtotal, offer.currency)}</b></div>
                  <p className="mt-3 flex items-start gap-2 text-sm text-slate-600"><MapPin size={16} className="mt-0.5 shrink-0" />{[item.surface.carrier.street, item.surface.carrier.locality, item.surface.carrier.city].filter(Boolean).join(', ')}</p>
                  {item.clientDescription && <p className="mt-4 text-sm leading-6 text-slate-600">{item.clientDescription}</p>}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1.5">{date(item.dateFrom)} – {date(item.dateTo)}</span>{item.surface.size && <span className="rounded-full bg-slate-100 px-3 py-1.5">{item.surface.size}</span>}</div>
                </div>
              </article>;
            })}</div>
          </div>)}
        </section>
        <section className="grid gap-8 rounded-3xl bg-slate-950 p-7 text-white md:grid-cols-[1fr_360px] md:p-10">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Kalkulace</p><h2 className="mt-3 text-3xl font-semibold">Transparentní rozpočet</h2><ul className="mt-7 space-y-3 text-sm text-slate-300"><li className="flex gap-2"><CheckCircle2 size={18} className="text-emerald-300" /> Ceny a slevy jsou počítány serverově s přesností Decimal.</li><li className="flex gap-2"><CheckCircle2 size={18} className="text-emerald-300" /> Platnost nabídky do {date(offer.validUntil)}.</li><li className="flex gap-2"><CheckCircle2 size={18} className="text-emerald-300" /> Realizace podléhá potvrzení dostupnosti ploch.</li></ul></div>
          <dl className="space-y-3 rounded-2xl bg-white/10 p-6 text-sm"><div className="flex justify-between"><dt>Mezisoučet</dt><dd>{money(offer.subtotalBeforeDiscount, offer.currency)}</dd></div><div className="flex justify-between"><dt>Slevy</dt><dd>− {money(offer.discountAmount, offer.currency)}</dd></div><div className="flex justify-between"><dt>Cena bez DPH</dt><dd>{money(offer.subtotal, offer.currency)}</dd></div><div className="flex justify-between"><dt>DPH {offer.taxRate} %</dt><dd>{money(offer.taxAmount, offer.currency)}</dd></div><div className="mt-4 flex justify-between border-t border-white/20 pt-4 text-lg font-semibold"><dt>Celkem</dt><dd>{money(offer.totalWithTax, offer.currency)}</dd></div></dl>
        </section>
        <section className="grid gap-6 border-t border-slate-200 pt-10 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Váš kontakt</p><h3 className="mt-3 text-2xl font-semibold">{offer.createdBy.name}</h3><p className="mt-2 text-slate-600">{offer.createdBy.email || 'SeePOINT obchodní tým'}</p></div><div className="text-sm leading-6 text-slate-500"><b className="text-slate-800">Obchodní podmínky</b><p className="mt-2">Nabídka je platná do uvedeného data. Termíny instalace a dostupnost ploch budou finálně potvrzeny při přijetí nabídky.</p></div></section>
      </div>
    </article>
  );
}
