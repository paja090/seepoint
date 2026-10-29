import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { LandPermitsView } from '@/components/cadastre/LandPermitsView';

export const dynamic = 'force-dynamic';

export default async function LandPermitsPage() {
  const user = await requirePageAccess('carriers');

  const points = await prisma.electionRemovalPoint.findMany({
    where: {
      organizationId: user.organizationId!,
      OR: [
        { parcelNumber: { not: null } },
        { cadastralArea: { not: null } },
        { campaign: { name: { contains: 'pozemk', mode: 'insensitive' } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <LandPermitsView initialPoints={points} />
      </div>
    </AppShell>
  );
}
