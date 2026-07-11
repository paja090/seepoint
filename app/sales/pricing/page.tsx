import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { PricingBuilder } from '@/components/sales/PricingBuilder';

export const metadata = {
  title: 'Cenotvorba | SeePOINT',
};

export default function PricingPage() {
  return (
    <AppShell>
      <PageHeader
        title="Cenotvorba a kalkulace"
        description="Letní kampaň 2025 · McDonald's ČR s.r.o."
      />
      <PricingBuilder />
    </AppShell>
  );
}
