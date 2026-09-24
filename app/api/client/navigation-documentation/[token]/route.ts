import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { hashToken, buildSnapshotItem, documentationPhotoSelect, SnapshotItemData } from '@/lib/navigation-documentation';
import { enterPublicNavigationReportTenant } from '@/lib/public-tenant';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const owner = await enterPublicNavigationReportTenant(tokenHash);
  if (!owner) {
    return NextResponse.json({ error: 'Požadovaná fotodokumentace nebyla nalezena.' }, { status: 404 });
  }

  const report = await platformPrisma.navigationDocumentationReport.findFirst({
    where: { id: owner.id, organizationId: owner.organizationId },
    include: {
      client: { select: { name: true, logoFileName: true } },
      offer: { select: { campaignName: true, title: true } },
      navigationOffer: { select: { targetName: true, targetAddress: true } },
      items: {
        where: { isVisible: true },
        include: {
          navigationPoint: {
            include: {
              installedPhoto: { select: documentationPhotoSelect },
              sitePhoto: { select: documentationPhotoSelect },
            },
          },
          carrier: true,
          selectedPhoto: { select: documentationPhotoSelect },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!report || report.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Požadovaná fotodokumentace nebyla nalezena nebo není publikována.' }, { status: 404 });
  }

  const items: SnapshotItemData[] = report.items.map((item) => {
    const candidatePhoto = item.selectedPhoto || item.navigationPoint?.installedPhoto || item.navigationPoint?.sitePhoto || null;
    const photoId = candidatePhoto && !candidatePhoto.isPrivate ? candidatePhoto.id : null;

    let baseItem: SnapshotItemData;
    if (item.snapshot && typeof item.snapshot === 'object') {
      baseItem = { ...(item.snapshot as SnapshotItemData) };
    } else {
      baseItem = buildSnapshotItem({
        id: item.id,
        clientNote: item.clientNote,
        navigationPoint: item.navigationPoint,
        carrier: item.carrier,
        selectedPhoto: candidatePhoto,
      });
    }

    baseItem.photoUrl = null;
    if (photoId) {
      baseItem.photoUrl = `/api/client/navigation-documentation/${encodeURIComponent(token)}/photos/${encodeURIComponent(photoId)}`;
    }

    return baseItem;
  });

  const campaignTitle = report.offer?.campaignName || report.offer?.title || report.navigationOffer?.targetName || report.title;

  return NextResponse.json({
    title: report.title,
    description: report.description,
    quarter: report.quarter,
    year: report.year,
    publishedAt: report.publishedAt || report.createdAt,
    clientName: report.client.name,
    clientLogoUrl: report.client.logoFileName ? `/api/client/navigation-documentation/${encodeURIComponent(token)}/logo` : null,
    campaignTitle,
    itemsCount: items.length,
    items,
  });
}
