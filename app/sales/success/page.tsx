import { AppShell } from '@/components/AppShell';
import { CampaignSuccess } from '@/components/sales/CampaignSuccess';

export const metadata = {
  title: 'Kampaň vytvořena | SeePOINT',
};

export default function SuccessPage() {
  return (
    <AppShell>
      <CampaignSuccess />
    </AppShell>
  );
}
