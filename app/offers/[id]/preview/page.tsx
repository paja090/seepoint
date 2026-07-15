import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { OfferProcessStepper } from '@/components/offers/OfferProcessStepper';
import { OfferValidationError } from '@/lib/offers/domain';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function OfferPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  try {
    const offer = await getOffer(user, (await params).id) as OfferView;
    return (
      <AppShell>
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SeePOINT</p><h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Náhled klientské nabídky</h1><p className="mt-2 text-sm text-slate-600">Takto uvidí nabídku klient po otevření zabezpečeného odkazu.</p></div>
          <div className="flex gap-2"><Link className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" href={`/offers/${offer.id}/approval`}><ArrowLeft aria-hidden="true" size={16} />Zpět na schválení</Link><Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800" href={`/offers/${offer.id}`}><ExternalLink aria-hidden="true" size={16} />Detail nabídky</Link></div>
        </header>
        <OfferProcessStepper current="preview" offerId={offer.id!} />
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-800 ring-1 ring-sky-200"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={17} /><p>Toto je interní náhled s reálnými daty nabídky. Veřejný odkaz vytvoříte na detailu nabídky; interní poznámky a identifikátory se klientovi neposílají.</p></div>
        <OfferProposal offer={toProposalOffer(offer)} variant="internal" />
      </AppShell>
    );
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
