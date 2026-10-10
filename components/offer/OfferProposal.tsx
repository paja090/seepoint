'use client';

import { useCallback, useState, useEffect } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { ProposalCarrier, ProposalOffer } from '@/lib/offers/presentation';
import { BenefitsGrid } from './BenefitsGrid';
import { CampaignStrategyPhases } from './CampaignStrategyPhases';
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
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);
  const canRespond = true;

  const handleSelectCarrierFromMap = useCallback((carrierId: string) => {
    setSelectedCarrierId(carrierId);
    const el = document.getElementById(`carrier-card-${carrierId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleSelectCarrierFromShowcase = useCallback((carrier: ProposalCarrier) => {
    setSelectedCarrierId(carrier.id);
    const mapEl = document.getElementById('offer-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

  // ESC key listener for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxPhoto) {
        setLightboxPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {variant === 'public' && (
        <PublicOfferHeader branding={branding} salesperson={offer.salesperson} onDownloadPdf={handleDownloadPdf} onShare={handleShare} />
      )}

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-6 lg:gap-12 lg:px-6 lg:py-10">
        {/* 1. Hero */}
        <OfferHero
          offer={offer}
          actionsEnabled={canRespond}
          onApprove={() => setAction('approve')}
          onRevision={() => setAction('revision')}
          onQuestion={() => setAction('question')}
        />

        {/* 2. Key Stats */}
        <OfferStats offer={offer} />

        {/* 3. AI Campaign Strategy, Phases & Position Rationale */}
        <CampaignStrategyPhases offer={offer} />

        {/* 4. Large Full-Width Interactive Map */}
        <div id="offer-map" className="scroll-mt-6">
          <OfferMapPreview
            offer={offer}
            selectedCarrierId={selectedCarrierId}
            onSelectCarrier={handleSelectCarrierFromMap}
          />
        </div>

        {/* 5. Pricing & Financial Breakdown */}
        <PricingSummary offer={offer} />

        {/* 6. Media Mix Overview */}
        <MediaMix offer={offer} />

        {/* 7. Carriers Showcase with AI Rationale & Photo Strip */}
        <CarrierShowcase
          offer={offer}
          selectedCarrierId={selectedCarrierId}
          onOpenCarrier={handleSelectCarrierFromShowcase}
          onOpenPhoto={(url, title) => setLightboxPhoto({ url, title })}
        />

        {/* 8. Benefits */}
        <BenefitsGrid offer={offer} />

        {/* 9. Case Studies */}
        <CaseStudies offer={offer} />

        {/* 10. References */}
        <ReferencesSection offer={offer} />

        {/* 11. Conditions & Contact Card */}
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <ConditionsSection offer={offer} />
          <ContactCard salesperson={offer.salesperson} onQuestion={() => setAction('question')} />
        </div>

        {/* 12. Bottom CTA */}
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

      {/* Lightbox Photo Preview Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3 text-white">
              <p className="font-extrabold text-sm truncate pr-4">{lightboxPhoto.title}</p>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                title="Zavřít"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-2 bg-slate-950 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

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
