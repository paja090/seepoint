import { ProposalHeader } from '@/components/proposal/ProposalHeader';
import { ProposalHero } from '@/components/proposal/ProposalHero';
import { StatsRow } from '@/components/proposal/StatsRow';
import { LocationMap } from '@/components/proposal/LocationMap';
import { MediaMix } from '@/components/proposal/MediaMix';
import { SelectedCarriers } from '@/components/proposal/SelectedCarriers';
import { PriceCalculation } from '@/components/proposal/PriceCalculation';
import { WhyCampaign } from '@/components/proposal/WhyCampaign';
import { ClientReferences } from '@/components/proposal/ClientReferences';
import { CaseStudies } from '@/components/proposal/CaseStudies';
import { ContactCard } from '@/components/proposal/ContactCard';
import { ProposalFooter } from '@/components/proposal/ProposalFooter';

export const metadata = {
  title: 'Summer Campaign 2026 · Proposal for McDonald\u2019s Czech Republic — SeePOINT',
  description:
    'A premium out-of-home advertising proposal by SeePOINT: 43 carriers, 7 cities, 809,000 estimated reach.',
};

export default function ProposalPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <ProposalHeader />
      <ProposalHero />
      <StatsRow />
      <LocationMap />
      <MediaMix />
      <SelectedCarriers />
      <PriceCalculation />
      <WhyCampaign />
      <ClientReferences />
      <CaseStudies />
      <ContactCard />
      <ProposalFooter />
    </main>
  );
}
