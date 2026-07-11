import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { CampaignPlanner } from '@/components/sales/CampaignPlanner';

export const metadata = {
  title: 'Plánovač kampaně | SeePOINT',
};

export default function PlannerPage() {
  return (
    <AppShell>
      <PageHeader
        title="Plánovač kampaně"
        description="Letní kampaň 2025 · McDonald's ČR s.r.o."
      />
      <CampaignPlanner />
    </AppShell>
  );
}
