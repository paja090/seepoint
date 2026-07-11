import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { ClientFeedback } from '@/components/sales/ClientFeedback';

export const metadata = {
  title: 'Zpětná vazba klienta | SeePOINT',
};

export default function FeedbackPage() {
  return (
    <AppShell>
      <PageHeader
        title="Zpětná vazba klienta"
        description="Letní kampaň 2025 · McDonald's ČR s.r.o."
      />
      <ClientFeedback />
    </AppShell>
  );
}
