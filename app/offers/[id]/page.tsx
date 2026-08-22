import { AlertCircle, ArrowLeft, CheckCircle2, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { OfferActions } from '@/components/offers/OfferActions';
import { OfferWorkflowStepper } from '@/components/offers/OfferWorkflowStepper';
import { SpecializedOfferSummary } from '@/components/offers/SpecializedOfferSummary';
import { StatusBadge } from '@/components/StatusBadge';
import { Card } from '@/components/ui';
import { OfferValidationError } from '@/lib/offers/domain';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

const eventLabels: Record<string, string> = {
  CREATED: 'Nabídka vytvořena',
  UPDATED: 'Nabídka upravena',
  DUPLICATED: 'Nabídka duplikována',
  PUBLISHED: 'Veřejný odkaz vytvořen',
  SENT: 'Nabídka odeslána',
  VIEWED: 'Nabídka zobrazena klientem',
  ACCEPTED: 'Nabídka přijata',
  REJECTED: 'Nabídka zamítnuta',
  EXPIRED: 'Platnost ukončena',
  QUESTION: 'Klient položil otázku',
  CONVERTED: 'Převedeno na obsazenost',
  ARCHIVED: 'Nabídka archivována',
};

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  let offer: OfferView;

  try {
    offer = await getOffer(user, (await params).id) as OfferView;
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const domainChecks = offer.offerType === 'NAVIGATION'
    ? [{ label: 'Cíl a GPS navigace', complete: Boolean(offer.navigation?.targetName) }, { label: 'Naplánované navigační body', complete: Boolean(offer.navigation?.points.length) }]
    : offer.offerType === 'CITY_GALLERY'
      ? [{ label: 'Koncept projektu', complete: Boolean(offer.cityGallery?.concept) }, { label: 'Lokalita nebo zadání prostoru', complete: Boolean(offer.cityGallery?.locationBrief) }]
      : [{ label: 'Vybrané reklamní plochy', complete: offer.items.length > 0 }, { label: 'Termíny kampaně', complete: offer.items.length > 0 && offer.items.every((item) => item.dateFrom && item.dateTo) }];
  const checks = [{ label: 'Klient a kontaktní osoba', complete: Boolean(offer.client.name && offer.contactPerson && offer.contactEmail) }, ...domainChecks, { label: 'Veřejná prezentace', complete: Boolean(offer.hasPublicLink) }];

  return (
    <AppShell>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href="/offers">
            <ArrowLeft aria-hidden="true" size={16} />
            Zpět na nabídky
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{offer.campaignName}</h1>
          <p className="mt-2 text-sm text-slate-500">{offer.client.name} · vytvořil {offer.createdBy.name}</p>
        </div>
        <StatusBadge value={offer.status} />
      </header>

      <OfferWorkflowStepper converted={offer.converted} events={offer.events} status={offer.status} />

      {offer.offerType === 'STANDARD_MEDIA' || !offer.offerType
        ? <OfferProposal offer={toProposalOffer(offer)} variant="internal" />
        : <SpecializedOfferSummary offer={offer} />}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Kontrola</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Připravenost nabídky</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {checks.filter((check) => check.complete).length}/{checks.length}
              </span>
            </div>
            <ul className="mt-5 space-y-3">
              {checks.map((check) => (
                <li className="flex items-center gap-3 text-sm" key={check.label}>
                  {check.complete
                    ? <CheckCircle2 aria-hidden="true" className="shrink-0 text-emerald-600" size={18} />
                    : <AlertCircle aria-hidden="true" className="shrink-0 text-amber-500" size={18} />}
                  <span className={check.complete ? 'text-slate-700' : 'font-medium text-slate-950'}>{check.label}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <div>
                <dt className="text-slate-500">Interní poznámka</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-800">{offer.internalNote || 'Bez interní poznámky'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Poslední změna</dt>
                <dd className="font-medium text-slate-700">{new Date(offer.updatedAt).toLocaleString('cs-CZ')}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktivita</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Historie nabídky</h2>
            </div>
            {offer.events?.length ? (
              <ol className="mt-5 space-y-4">
                {offer.events.map((event) => (
                  <li className="relative border-l border-slate-200 pb-1 pl-5 text-sm" key={event.id}>
                    <span aria-hidden="true" className="absolute -left-1.5 top-1 size-3 rounded-full border-2 border-white bg-slate-400" />
                    <p className="font-semibold text-slate-800">{eventLabels[event.type] ?? event.type}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 aria-hidden="true" size={13} />
                      {event.actorName || 'Systém'} · {new Date(event.createdAt).toLocaleString('cs-CZ')}
                    </p>
                    {event.message && <p className="mt-2 whitespace-pre-wrap text-slate-600">{event.message}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Zatím bez zaznamenané aktivity.</p>
            )}
          </Card>
        </div>

        <OfferActions
          canConvert={user.role === 'ADMIN' || user.role === 'MANAGER'}
          converted={Boolean(offer.converted)}
          offerType={offer.offerType ?? 'STANDARD_MEDIA'}
          offerId={offer.id!}
          status={offer.status}
          isNoPriceConcept={Boolean(offer.isNoPriceConcept)}
          navigationProposalMode={(offer.navigation as unknown as { proposalMode?: string } | null)?.proposalMode}
          navigationSelectionSubmitted={(offer.navigation as unknown as { selectionSubmitted?: boolean } | null)?.selectionSubmitted}
        />
      </div>
    </AppShell>
  );
}
