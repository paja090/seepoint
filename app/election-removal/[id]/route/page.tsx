import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { MobileRouteExecutionView } from '@/components/election-removal/MobileRouteExecutionView';
import { ArrowLeft, Route } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ElectionRemovalRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ crew?: string }>;
}) {
  const user = await checkElectionRemovalPageAccess();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCrewId = resolvedSearchParams?.crew;

  const campaign = await prisma.electionCampaign.findFirst({
    where: {
      id,
      organizationId: user.organization!.id,
    },
    include: {
      points: {
        include: {
          photos: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { plannedOrder: 'asc' },
          { layerName: 'asc' },
          { label: 'asc' },
        ],
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <Link
            href={`/election-removal/${campaign.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zpět na přehled kampaně</span>
          </Link>
        </div>

        <MobileRouteExecutionView
          campaign={campaign}
          points={campaign.points}
          initialCrewId={initialCrewId}
        />
      </div>
    </AppShell>
  );
}
