import { AlertTriangle, Camera, CheckCircle2, ImageOff, MapPinOff, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { OfferView } from '@/lib/offers/view-model';
import { offerDateRange, offerMissingAssets, type OfferConflictView } from '@/lib/offers/workflow';
import { OfferProcessStepper } from './OfferProcessStepper';
import { OfferSendControl } from './OfferSendControl';

type CheckStatus = 'ok' | 'warning' | 'error';
type CheckItem = { id: string; label: string; detail: string; status: CheckStatus };

const statusMeta: Record<CheckStatus, { icon: React.ReactNode; ring: string; bg: string; text: string; label: string }> = {
  ok: { icon: <CheckCircle2 size={18} />, ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'V pořádku' },
  warning: { icon: <AlertTriangle size={18} />, ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Upozornění' },
  error: { icon: <XCircle size={18} />, ring: 'ring-red-200', bg: 'bg-red-50', text: 'text-red-700', label: 'Chybí' },
};

export function OfferApproval({ offer, conflicts }: { offer: OfferView; conflicts: OfferConflictView[] }) {
  const assets = offerMissingAssets(offer);
  const range = offerDateRange(offer);
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'block');
  const contactReady = Boolean(offer.client.name && offer.contactPerson && offer.contactEmail);
  const datesReady = Boolean(range.from && range.to && range.days > 0);
  const calculationReady = Number(offer.totalWithTax ?? 0) > 0;
  const photosMissing = assets.filter((asset) => asset.kind === 'photo');
  const gpsMissing = assets.filter((asset) => asset.kind === 'gps');
  const checks: CheckItem[] = [
    { id: 'client', label: 'Klient a fakturační údaje', detail: contactReady ? 'Klient, kontaktní osoba a e-mail jsou vyplněné.' : 'Doplňte klienta, kontaktní osobu a e-mail.', status: contactReady ? 'ok' : 'error' },
    { id: 'dates', label: 'Termín kampaně', detail: datesReady ? `${range.from} – ${range.to} (${range.days} dní).` : 'Termín kampaně není kompletní.', status: datesReady ? 'ok' : 'error' },
    { id: 'availability', label: 'Dostupnost ploch', detail: conflicts.length ? `${offer.items.length - new Set(conflicts.map((conflict) => conflict.surfaceId)).size} z ${offer.items.length} ploch bez evidované kolize.` : `Všech ${offer.items.length} ploch je bez evidované kolize.`, status: hardConflicts.length ? 'error' : conflicts.length ? 'warning' : 'ok' },
    { id: 'photos', label: 'Fotodokumentace ploch', detail: photosMissing.length ? `Chybí fotografie u ${photosMissing.length} ploch.` : 'Všechny plochy mají dostupnou fotografii.', status: photosMissing.length ? 'error' : 'ok' },
    { id: 'gps', label: 'GPS souřadnice', detail: gpsMissing.length ? `Chybí GPS u ${gpsMissing.length} ploch.` : 'Všechny plochy mají GPS souřadnice.', status: gpsMissing.length ? 'error' : 'ok' },
    { id: 'calculation', label: 'Kalkulace nabídky', detail: calculationReady ? 'Serverová kalkulace včetně DPH je připravena.' : 'Celková cena nabídky není platná.', status: calculationReady ? 'ok' : 'error' },
    { id: 'visual', label: 'Grafické podklady', detail: offer.items.some((item) => item.surface.photos.length > 0) ? 'Klientský vizuál používá reálné fotografie ploch.' : 'Klientský vizuál nemá žádnou reálnou fotografii.', status: offer.items.some((item) => item.surface.photos.length > 0) ? 'ok' : 'warning' },
  ];
  const errorCount = checks.filter((check) => check.status === 'error').length;
  const canSend = errorCount === 0;

  return (
    <div className="space-y-6">
      <OfferProcessStepper current="approval" offerId={offer.id!} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="card">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-slate-500" size={18} /><h2 className="text-base font-semibold text-slate-950">Kontrola před odesláním</h2><span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${errorCount ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>{checks.filter((check) => check.status === 'ok').length}/{checks.length} splněno</span></div>
            <ul className="space-y-2.5">{checks.map((item) => { const meta = statusMeta[item.status]; return <li className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${meta.ring} ${meta.bg}`} key={item.id}><span className={`mt-0.5 ${meta.text}`}>{meta.icon}</span><div><div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{item.label}</p><span className={`text-xs font-semibold ${meta.text}`}>· {meta.label}</span></div><p className="mt-0.5 text-sm text-slate-600">{item.detail}</p></div></li>; })}</ul>
          </section>

          <section className="card">
            <div className="mb-4 flex items-center gap-2"><ImageOff aria-hidden="true" className="text-slate-500" size={18} /><h2 className="text-base font-semibold text-slate-950">Chybějící podklady</h2><span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${assets.length ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>{assets.length ? `${assets.length} k doplnění` : 'Kompletní'}</span></div>
            {assets.length === 0 ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 aria-hidden="true" size={16} />Všechny podklady jsou kompletní.</p> : <div className="space-y-2.5">{assets.map((asset) => <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3" key={asset.id}><span className={`grid size-9 place-items-center rounded-lg text-white ${asset.kind === 'photo' ? 'bg-purple-600' : 'bg-sky-600'}`}>{asset.kind === 'photo' ? <Camera aria-hidden="true" size={16} /> : <MapPinOff aria-hidden="true" size={16} />}</span><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{asset.code} · {asset.city}</p><p className="text-xs text-slate-500">{asset.kind === 'photo' ? 'Chybí fotodokumentace plochy' : 'Chybí GPS souřadnice'}</p></div><Link className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700" href="/carriers">Doplnit</Link></div>)}</div>}
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start"><OfferSendControl canSend={canSend} missingCount={errorCount} offerId={offer.id!} status={offer.status} /></aside>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 pt-6"><Link className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href={`/offers/${offer.id}/pricing`}>← Zpět: Cenotvorba</Link><Link className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white" href={`/offers/${offer.id}/preview`}>Pokračovat: Nabídka klientovi →</Link></footer>
    </div>
  );
}
