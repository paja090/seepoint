import { AppShell } from '@/components/AppShell';
import { OfferTemplatesCatalogView } from '@/components/offers/OfferTemplatesCatalogView';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function OfferTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requirePageAccess('offers');
  const { clientId } = await searchParams;

  const clients = await prisma.client.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <AppShell>
      <OfferTemplatesCatalogView clients={clients} />
    </AppShell>
  );
}
