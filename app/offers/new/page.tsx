import { AppShell } from '@/components/AppShell';
import { NewOfferSelectorClient } from '@/components/offers/NewOfferSelectorClient';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';

export default async function NewOfferTypePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  await requirePageAccess('offers');
  const { clientId } = await searchParams;

  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return (
    <AppShell>
      <PageHeader
        description="Vyberte způsob sestavení nabídky. Použijte AI Copilota pro rychlý automatický návrh nebo pokračujte manuálně."
        title="Jaký typ nabídky vytváříte?"
      />
      <NewOfferSelectorClient clientId={clientId} clientOptions={clients} />
    </AppShell>
  );
}
