import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import {
  buildRealizationContext,
  determineRealizationNextBestActions,
} from '@/lib/ai-realization/realization-engine';
import { RealizationDetailView } from '@/components/ai-realization/RealizationDetailView';
import type { PendingChangeSetItem } from '@/components/ai-realization/RealizationChangeSetCard';

export const dynamic = 'force-dynamic';

export default async function RealizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess('realization');
  const { id } = await params;
  const organizationId = user.organizationId!;
  const profile = await getOrganizationRealizationProfile(organizationId);

  const context = await buildRealizationContext(id, user, profile);
  if (!context) notFound();

  const pendingChangeSets = context.hasPendingChangeSet
    ? await prisma.navigationChangeSet.findMany({
        where: {
          organizationId,
          status: 'PENDING',
          OR: [
            { crmOrderId: id },
            ...(context.navigationOrderId ? [{ navigationOrderId: context.navigationOrderId }] : []),
            ...(context.offerId ? [{ offerId: context.offerId }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const nextBestActions = determineRealizationNextBestActions(context);

  return (
    <AppShell>
      <RealizationDetailView
        context={context}
        pendingChangeSets={pendingChangeSets as unknown as PendingChangeSetItem[]}
        nextBestActions={nextBestActions}
      />
    </AppShell>
  );
}
