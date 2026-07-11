import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { CampaignConversion } from '@/components/sales/CampaignConversion';

export const metadata = {
  title: 'Převod na kampaň | SeePOINT',
};

export default function ConversionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Převod na rezervace"
        description="Letní kampaň 2025 · McDonald's ČR s.r.o."
      />
      <CampaignConversion />
    </AppShell>
  );
}
