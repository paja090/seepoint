import { AppShell } from '@/components/AppShell';
import { CampaignWizard } from '@/components/sales/CampaignWizard';

export const metadata = {
  title: 'Nový návrh kampaně | SeePOINT',
};

export default function NewCampaignPage() {
  return (
    <AppShell>
      <CampaignWizard />
    </AppShell>
  );
}
