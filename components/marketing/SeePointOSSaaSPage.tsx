'use client';

import { useState } from 'react';
import { SaaSHeader } from './SaaSHeader';
import { SaaSHero } from './SaaSHero';
import { SaaSProductShowcase } from './SaaSProductShowcase';
import { SaaSProblemSolution } from './SaaSProblemSolution';
import { SaaSBentoOverview } from './SaaSBentoOverview';
import { SaaSRoiCalculator } from './SaaSRoiCalculator';
import { SaaSMapSection } from './SaaSMapSection';
import { SaaSWorkflowSection } from './SaaSWorkflowSection';
import { SaaSAiSection } from './SaaSAiSection';
import { SaaSFieldMobileSection } from './SaaSFieldMobileSection';
import { SaaSNavigationSection } from './SaaSNavigationSection';
import { SaaSTargetAudience } from './SaaSTargetAudience';
import { SaaSOnboardingSection } from './SaaSOnboardingSection';
import { SaaSIntegrationsSection } from './SaaSIntegrationsSection';
import { SaaSSecuritySection } from './SaaSSecuritySection';
import { SaaSProductOrigin } from './SaaSProductOrigin';
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

      {/* Main Content Sections */}
      <main>
        <SaaSHero onOpenDemoModal={openDemoModal} />
        <SaaSProductShowcase />
        <SaaSProblemSolution />
        <SaaSBentoOverview />
        <SaaSRoiCalculator onOpenDemoModal={openDemoModal} />
        <SaaSMapSection onOpenDemoModal={openDemoModal} />
        <SaaSWorkflowSection />
        <SaaSAiSection onOpenDemoModal={openDemoModal} />
        <SaaSFieldMobileSection />
        <SaaSNavigationSection onOpenDemoModal={openDemoModal} />
        <SaaSTargetAudience onOpenDemoModal={openDemoModal} />
        <SaaSOnboardingSection onOpenDemoModal={openDemoModal} />
        <SaaSIntegrationsSection />
        <SaaSSecuritySection />
        <SaaSProductOrigin />
        <SaaSPricingSection onOpenDemoModal={openDemoModal} />
        <SaaSFaqSection />
        <SaaSFinalCta onOpenDemoModal={openDemoModal} />
      </main>

      {/* Footer */}
      <SaaSFooter onOpenDemoModal={openDemoModal} />

      {/* Demo Booking Modal */}
      <SaaSDemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
    </div>
  );
}
