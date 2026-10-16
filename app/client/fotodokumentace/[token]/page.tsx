import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { verifyCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { enterPublicCampaignAlbumTenant } from '@/lib/public-tenant';
import {
  PublicCampaignAlbumView,
  type PublicPointItem,
} from '@/components/election-removal/PublicCampaignAlbumView';

export const dynamic = 'force-dynamic';

export default async function PublicFotodokumentacePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  const { month } = await searchParams;

  const campaignId = verifyCampaignAlbumSlug(token);
  if (!campaignId) notFound();

  const campaignMeta = await enterPublicCampaignAlbumTenant(token);
  if (!campaignMeta) notFound();

  const campaign = await prisma.electionCampaign.findFirst({
    where: { id: campaignMeta.id, organizationId: campaignMeta.organizationId },
    include: {
      points: {
        include: {
          photos: {
            where: { isPrivate: false },
            select: {
              id: true,
              type: true,
              fileName: true,
              createdAt: true,
              capturedLatitude: true,
              capturedLongitude: true,
              capturedByWorkerName: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { label: 'asc' },
      },
    },
  });

  if (!campaign) notFound();

  // Extract all available periods (year-month) across all photos
  const periodsSet = new Set<string>();
  for (const point of campaign.points) {
    for (const photo of point.photos) {
      const d = new Date(photo.createdAt);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        periodsSet.add(`${y}-${m}`);
      }
    }
  }
  const availablePeriods = Array.from(periodsSet).sort().reverse();

  const points: PublicPointItem[] = campaign.points.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    mediaType: p.mediaType,
    objectType: p.objectType,
    quantity: p.quantity,
    latitude: p.latitude,
    longitude: p.longitude,
    operationType: p.operationType,
    photos: p.photos.map((ph) => ({
      id: ph.id,
      type: ph.type,
      fileName: ph.fileName,
      createdAt: ph.createdAt.toISOString(),
      capturedLatitude: ph.capturedLatitude,
      capturedLongitude: ph.capturedLongitude,
      capturedByWorkerName: ph.capturedByWorkerName,
      url: `/api/client/fotodokumentace/${encodeURIComponent(token)}/photos/${encodeURIComponent(ph.id)}`,
    })),
  }));

  return (
    <PublicCampaignAlbumView
      token={token}
      campaign={{
        id: campaign.id,
        name: campaign.name,
        clientName: campaign.clientName,
        description: campaign.description,
        targetDate: campaign.targetDate ? campaign.targetDate.toISOString() : null,
        totalPoints: campaign.totalPoints,
        completedPoints: campaign.completedPoints,
      }}
      points={points}
      availablePeriods={availablePeriods}
      initialPeriod={month}
    />
  );
}
