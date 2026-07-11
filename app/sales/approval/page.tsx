import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { ApprovalReview } from '@/components/sales/ApprovalReview';

export const metadata = {
  title: 'Interní schválení | SeePOINT',
};

export default function ApprovalPage() {
  return (
    <AppShell>
      <PageHeader
        title="Interní schválení nabídky"
        description="Letní kampaň 2025 · McDonald's ČR s.r.o."
      />
      <ApprovalReview />
    </AppShell>
  );
}
