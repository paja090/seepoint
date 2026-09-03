import type { Metadata } from 'next';
import { getPublicOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { CampaignLivePortalView } from '@/components/campaign-portal/CampaignLivePortalView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const { token } = await params;
    const offer = (await getPublicOffer(token).catch(() => null)) as OfferView | null;
    if (!offer) {
      return {
        title: 'Klientský Portál Kampaně | SeePOINT',
        robots: { index: false, follow: false },
      };
    }
    const title = `${offer.campaignName || offer.title || 'Kampaň'} | ${offer.branding?.name || 'SeePOINT'}`;
    const description = `Živý klientský portál a fotodokumentace vylepu outdoorové kampaně pro ${offer.client?.name || 'klienta'}.`;

    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website' },
    };
  } catch {
    return {
      title: 'Klientský Portál Kampaně | SeePOINT',
      robots: { index: false, follow: false },
    };
  }
}

export default async function PublicCampaignPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let offer: OfferView | null = null;

  try {
    offer = (await getPublicOffer(token)) as OfferView;
  } catch (error) {
    console.error('[PublicCampaignPortalPage] Load error:', error);
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seepoint-logo.svg" alt="SeePOINT" className="h-10 mx-auto object-contain" />
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-amber-950 space-y-2">
            <h2 className="text-xl font-black">Kampaň nebyla nalezena</h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              Odkaz na tuto kampaň již není platný nebo byl vygenerován nový odkaz. Zkontrolujte prosím nejnovější zprávu od vašeho obchodníka.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <CampaignLivePortalView offer={offer} publicToken={token} />;
}
