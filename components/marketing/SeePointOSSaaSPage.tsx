'use client';

import { useState } from 'react';
import { SaaSHeader } from './SaaSHeader';
import { SaaSHero } from './SaaSHero';
import { SaaSAudienceStrip } from './SaaSAudienceStrip';
import { SaaSProblemSolution } from './SaaSProblemSolution';
import { SaaSProductVideoSection } from './SaaSProductVideoSection';
import { SaaSProductShowcase } from './SaaSProductShowcase';
import { SaaSBentoOverview } from './SaaSBentoOverview';
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

  const openDemoModal = () => setIsDemoModalOpen(true);
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
              price: '0',
              priceCurrency: 'CZK',
            },
            description:
              'Operační systém pro venkovní reklamu. Reklamní plochy, klienti, nabídky, kampaně, realizace, fotodokumentace a AI v jednom systému.',
          }),
        }}
      />

      {/* Header */}
      <SaaSHeader onOpenDemoModal={openDemoModal} isLoggedIn={isLoggedIn} />

      {/* Main Content Sections in Optimized Logical Order */}
      <main>
        {/* 1. Hero */}
        <SaaSHero onOpenDemoModal={openDemoModal} />

        {/* 2. Krátký „Pro koho“ trust strip */}
        <SaaSAudienceStrip />

        {/* 3. Excel vs SeePoint */}
        <SaaSProblemSolution />

        {/* 4. Produktové video / připravený video placeholder */}
        <SaaSProductVideoSection onOpenDemoModal={openDemoModal} />

        {/* 5. Interaktivní produktová ukázka (5 klíčových modulů) */}
        <SaaSProductShowcase />

        {/* 6. Kompaktní hlavní přínosy */}
        <SaaSBentoOverview />

        {/* 7. Workflow proces */}
        <SaaSWorkflowSection />

        {/* 8. Vznikl v reálném provozu */}
        <SaaSProductOrigin />

        {/* 9. Budoucí klientské reference (skryté, dokud nejsou reálná data) */}
        <SaaSCustomerReferences />

        {/* 10. SeePoint AI */}
        <SaaSAiSection onOpenDemoModal={openDemoModal} />

        {/* 11. Mobilní aplikace pro terén */}
        <SaaSFieldMobileSection />

        {/* 12. Navigace VO */}
        <SaaSNavigationSection onOpenDemoModal={openDemoModal} />

        {/* 13. Orientační ROI kalkulačka */}
        <SaaSRoiCalculator onOpenDemoModal={openDemoModal} />

        {/* 14. SeePoint Network – prémiový teaser */}
        <SaaSNetworkSection onOpenDemoModal={openDemoModal} />

        {/* 15. Migrace a asistovaný onboarding */}
        <SaaSOnboardingSection onOpenDemoModal={openDemoModal} />

        {/* 16. Integrace & Důvěra/Bezpečnost */}
        <SaaSIntegrationsSection />
        <SaaSSecuritySection />

        {/* 17. Přehledný ceník */}
        <SaaSPricingSection onOpenDemoModal={openDemoModal} />

        {/* 18. Časté dotazy (FAQ) */}
        <SaaSFaqSection />

        {/* 19. Final CTA s lead magnetem na vlastní data */}
        <SaaSFinalCta onOpenDemoModal={openDemoModal} />
      </main>

      {/* Footer */}
      <SaaSFooter onOpenDemoModal={openDemoModal} />

      {/* Demo Booking Modal */}
      <SaaSDemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
    </div>
  );
}
