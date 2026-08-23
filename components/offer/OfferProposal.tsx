'use client';

import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { ProposalOffer } from '@/lib/offers/presentation';
import { BenefitsGrid } from './BenefitsGrid';
import { CarrierShowcase } from './CarrierShowcase';
import { CaseStudies } from './CaseStudies';
import { ConditionsSection } from './ConditionsSection';
import { ContactCard } from './ContactCard';
import { MediaMix } from './MediaMix';
import { OfferActionDialog, type OfferActionType } from './OfferActionDialog';
import { OfferCta } from './OfferCta';
import { OfferHero } from './OfferHero';
import { OfferMapPreview } from './OfferMapPreview';
import { OfferStats } from './OfferStats';
import { PricingSummary } from './PricingSummary';
import { PublicOfferFooter } from './PublicOfferFooter';
import { PublicOfferHeader } from './PublicOfferHeader';
import { ReferencesSection } from './ReferencesSection';

export function OfferProposal({
  offer,
  variant = 'public',
  token,
  branding,
}: {
  offer: ProposalOffer;
  variant?: 'public' | 'internal';
  token?: string;
  branding?: { name: string; logoUrl?: string | null; email?: string | null; phone?: string | null } | null;
}) {
  const [action, setAction] = useState<OfferActionType | null>(null);
  const [copied, setCopied] = useState(false);
  const canRespond = true;

  const scrollToMap = useCallback(() => {
    document.getElementById('offer-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleDownloadPdf = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (token) {
      window.location.assign(`/api/proposals/${encodeURIComponent(token)}/pdf`);
      return;
    }
    window.print();
  }, [token]);

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: offer.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* user cancelled share – no-op */
    }
  }, [offer.title]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {variant === 'public' && (
        <PublicOfferHeader branding={branding} salesperson={offer.salesperson} onDownloadPdf={handleDownloadPdf} onShare={handleShare} />
      )}

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-6 lg:gap-14 lg:px-6 lg:py-10">
        <OfferHero
          offer={offer}
          actionsEnabled={canRespond}
          onApprove={() => setAction('approve')}
          onRevision={() => setAction('revision')}
          onQuestion={() => setAction('question')}
        />

        <OfferStats offer={offer} />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]" id="offer-map">
          <OfferMapPreview offer={offer} />
          <PricingSummary offer={offer} />
        </div>

        <MediaMix offer={offer} />

        <CarrierShowcase offer={offer} onOpenCarrier={scrollToMap} />

        <BenefitsGrid offer={offer} />

        <CaseStudies offer={offer} />

        <ReferencesSection offer={offer} />

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <ConditionsSection offer={offer} />
          <ContactCard salesperson={offer.salesperson} onQuestion={() => setAction('question')} />
        </div>

        {canRespond && (
          <OfferCta
            onApprove={() => setAction('approve')}
            onRevision={() => setAction('revision')}
            onQuestion={() => setAction('question')}
          />
        )}
      </main>

      {variant === 'public' && <PublicOfferFooter branding={branding} />}

      <OfferActionDialog action={action} offerStatus={offer.status} onClose={() => setAction(null)} onReject={() => setAction('reject')} token={token} />

      {copied && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg print:hidden">
          <Check aria-hidden size={16} />
          Odkaz na nabídku byl zkopírován
          <Copy aria-hidden className="text-slate-400" size={14} />
        </div>
      )}
    </div>
  );
}
