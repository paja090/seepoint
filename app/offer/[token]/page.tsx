import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { SpecializedOfferSummary } from '@/components/offers/SpecializedOfferSummary';
import { SpecializedOfferResponseActions } from '@/components/offers/SpecializedOfferResponseActions';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getPublicOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { CampaignConceptPublicView } from '@/components/offers/CampaignConceptPublicView';
import { CampaignLivePortalView } from '@/components/campaign-portal/CampaignLivePortalView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const { token } = await params;
    const offer = await getPublicOffer(token).catch(() => null) as OfferView | null;
    if (!offer) {
      return {
        title: 'Nabídka | SeePOINT',
        robots: { index: false, follow: false },
      };
    }
    const title = `${offer.campaignName || offer.title || 'Nabídka'} | ${offer.branding?.name || 'SeePOINT'}`;
    const description = offer.clientMessage || offer.campaignGoal || `Reklamní nabídka připravená pro ${offer.client?.name || 'klienta'}.`;

    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website' },
    };
  } catch {
    return {
      title: 'Nabídka | SeePOINT',
      robots: { index: false, follow: false },
    };
  }
}

export default async function PublicOfferPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ view?: string }> }) {
  const { token } = await params;
  let offer: OfferView | null = null;

  try {
    offer = (await getPublicOffer(token)) as OfferView;
  } catch (error) {
    console.error('[PublicOfferPage] Offer load error:', error);
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seepoint-logo.svg" alt="SeePOINT" className="h-10 mx-auto object-contain" />
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-amber-950 space-y-2">
            <h2 className="text-xl font-black">Nabídka nebyla nalezena</h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              Odkaz na tuto nabídku již není platný nebo byl vygenerován nový odkaz. Pokud jste nabídku obdrželi e-mailem, zkontrolujte prosím nejnovější zprávu od obchodníka SeePOINT.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Máte dotaz? Napište nám na{' '}
            <a href="mailto:info@seepoint.cz" className="text-sky-600 font-bold underline">
              info@seepoint.cz
            </a>
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition w-full"
          >
            Přejít na SeePOINT.cz
          </Link>
        </div>
      </div>
    );
  }

  if ((offer as unknown as { isNoPriceConcept?: boolean }).isNoPriceConcept) {
    return <CampaignConceptPublicView offer={offer} publicToken={token} />;
  }

  if (offer.offerType === 'NAVIGATION' || offer.offerType === 'CITY_GALLERY') {
    const navigationMode = (offer.navigation as unknown as { proposalMode?: string } | undefined)?.proposalMode;
    const isLocationSelection = offer.offerType === 'NAVIGATION' && navigationMode !== 'PRICED_QUOTE';
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
                  {offer.client?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`Logo ${offer.client.name}`} className="h-full w-full object-contain p-2" src={offer.client.logoUrl} />
                  ) : offer.branding?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`Logo ${offer.branding.name}`} className="h-full w-full object-contain p-2" src={offer.branding.logoUrl} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="SeePOINT" className="h-full w-full object-contain p-2" src="/seepoint-logo.svg" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-sky-600">{offer.branding?.name || 'SeePOINT'} · Nabídka navigace</p>
                  <h1 className="text-2xl font-black text-slate-900">{offer.campaignName || offer.title}</h1>
                  <p className="text-sm font-semibold text-slate-500">Připraveno pro společnost {offer.client?.name || 'klienta'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={offer.branding?.name || 'SeePOINT'} className="h-8 max-w-36 object-contain" src={offer.branding?.logoUrl || '/seepoint-logo.svg'} />
              </div>
            </div>
          </header>
          <SpecializedOfferSummary offer={offer} proposalKey={token} />
          {isLocationSelection ? null : <SpecializedOfferResponseActions status={offer.status} token={token} />}
        </div>
      </div>
    );
  }

  const search = await searchParams;
  if (['ACCEPTED', 'CONVERTED'].includes(offer.status) && search.view !== 'proposal') {
    return <CampaignLivePortalView offer={offer} publicToken={token} />;
  }

  return <OfferProposal branding={offer.branding} offer={toProposalOffer(offer)} token={token} />;
}
