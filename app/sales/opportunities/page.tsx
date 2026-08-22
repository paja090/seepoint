import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { getOpportunities, getOpportunityStats } from '@/lib/opportunities/service';
import { SalesOpportunitiesClientView } from '@/components/opportunities/SalesOpportunitiesClientView';

export const dynamic = 'force-dynamic';

export default async function SalesOpportunitiesPage() {
  await requirePageAccess('clients');

  const [opportunitiesData, stats, clients] = await Promise.all([
    getOpportunities({ take: 50 }),
    getOpportunityStats(),
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, name: true, pricingSegment: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <SalesOpportunitiesClientView
          clients={clients}
          initialOpportunityData={{
            items: JSON.parse(JSON.stringify(opportunitiesData.items)),
            total: opportunitiesData.total,
            stats,
          }}
        />
      </div>
    </AppShell>
  );
}
