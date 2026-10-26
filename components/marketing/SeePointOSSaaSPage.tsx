'use client';

import { useState } from 'react';
import { SaaSHeader } from './SaaSHeader';
import { SaaSHero } from './SaaSHero';
import { SaaSAudienceStrip } from './SaaSAudienceStrip';
import { SaaSProblemSolution } from './SaaSProblemSolution';
import { SaaSProductVideoSection } from './SaaSProductVideoSection';
import { SaaSProductShowcase } from './SaaSProductShowcase';
import { SaaSWorkflowSection } from './SaaSWorkflowSection';
import { SaaSProductOrigin } from './SaaSProductOrigin';
import { SaaSCustomerReferences } from './SaaSCustomerReferences';
import { SaaSAiSection } from './SaaSAiSection';
import { SaaSFieldMobileSection } from './SaaSFieldMobileSection';
import { SaaSNavigationSection } from './SaaSNavigationSection';
import { SaaSRoiCalculator } from './SaaSRoiCalculator';
import { SaaSNetworkSection } from './SaaSNetworkSection';
import { SaaSOnboardingSection } from './SaaSOnboardingSection';
import { SaaSIntegrationsSection } from './SaaSIntegrationsSection';
import { SaaSSecuritySection } from './SaaSSecuritySection';
import { SaaSPricingSection } from './SaaSPricingSection';
import { SaaSFaqSection } from './SaaSFaqSection';
import { SaaSFinalCta } from './SaaSFinalCta';
import { SaaSDemoModal } from './SaaSDemoModal';
import { SaaSFooter } from './SaaSFooter';

export function SeePointOSSaaSPage({ isLoggedIn }: { isLoggedIn?: boolean }) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalContext, setDemoModalContext] = useState<string | null>(null);

  const openDemoModal = (context?: string) => {
    setDemoModalContext(typeof context === 'string' ? context : null);
    setIsDemoModalOpen(true);
  };
  const closeDemoModal = () => setIsDemoModalOpen(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-600 selection:text-white antialiased overflow-x-hidden">
      {/* Structured JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'SeePoint OS',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '1900',
              priceCurrency: 'CZK',
            },
            description:
              'Operační systém pro venkovní reklamu. Reklamní plochy, klienti, nabídky, kampaně, realizace, fotodokumentace a AI v jednom systému.',
          }),
        }}
      />

      {/* Header */}
      <SaaSHeader onOpenDemoModal={() => openDemoModal()} isLoggedIn={isLoggedIn} />

      {/* Main Content Sections in Optimized Logical Order */}
      <main>
        {/* 1. Hero */}
        <SaaSHero onOpenDemoModal={() => openDemoModal('Ukázka na vlastních nosičích')} />

        {/* 2. Krátký „Pro koho“ trust strip */}
        <SaaSAudienceStrip />

        {/* 3. Excel vs SeePoint */}
        <SaaSProblemSolution />

        {/* 4. Produktové video s českým hlasovým průvodcem */}
        <SaaSProductVideoSection onOpenDemoModal={() => openDemoModal()} />

        {/* 5. Interaktivní produktová ukázka (5 klíčových modulů) */}
        <SaaSProductShowcase />

        {/* 6. Workflow proces */}
        <SaaSWorkflowSection />

        {/* 7. Vznikl v reálném provozu */}
        <SaaSProductOrigin />

        {/* 8. Budoucí klientské reference (skryté, dokud nejsou reálná data) */}
        <SaaSCustomerReferences />

        {/* 9. SeePoint AI */}
        <SaaSAiSection onOpenDemoModal={() => openDemoModal('SeePoint AI modul')} />

        {/* 10. Mobilní aplikace pro terén */}
        <SaaSFieldMobileSection />

        {/* 11. Navigace VO */}
        <SaaSNavigationSection onOpenDemoModal={() => openDemoModal('Modul Navigace VO')} />

        {/* 12. Orientační ROI kalkulačka */}
        <SaaSRoiCalculator onOpenDemoModal={() => openDemoModal('Kalkulace úspory na vlastních datech')} />

        {/* 13. SeePoint Network – prémiový teaser */}
        <SaaSNetworkSection onOpenDemoModal={() => openDemoModal('Zájem o SeePoint Network')} />

        {/* 14. Migrace a asistovaný onboarding */}
        <SaaSOnboardingSection onOpenDemoModal={() => openDemoModal('Asistovaný převod z Excelu')} />

        {/* 15. Integrace & Důvěra/Bezpečnost */}
        <SaaSIntegrationsSection />
        <SaaSSecuritySection />

        {/* 16. Přehledný ceník */}
        <SaaSPricingSection onOpenDemoModal={(planName?: string) => openDemoModal(planName ? `Tarif ${planName}` : undefined)} />

        {/* 17. Časté dotazy (FAQ) */}
        <SaaSFaqSection />

        {/* 18. Final CTA s lead magnetem na vlastní data */}
        <SaaSFinalCta onOpenDemoModal={(ctx?: string) => openDemoModal(ctx)} />
      </main>

      {/* Footer */}
      <SaaSFooter onOpenDemoModal={() => openDemoModal()} />

      {/* Demo Booking Modal */}
      <SaaSDemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} initialContext={demoModalContext} />
    </div>
  );
}
