import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashToken, buildSnapshotItem, SnapshotItemData } from '@/lib/navigation-documentation';
import { enterPublicNavigationReportTenant } from '@/lib/public-tenant';
import { runWithTenantContext } from '@/lib/tenant-context';
import { isClientApprovedPhoto, isPublicNavigationReportStatus } from '@/lib/navigation-documentation-policy';

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

  const report = await runWithTenantContext({ organizationId: owner.organizationId, source: 'public-token' }, () => prisma.navigationDocumentationReport.findUnique({
    where: { publicTokenHash: tokenHash },
    include: {
      client: { select: { name: true, logoFileName: true } },
      offer: { select: { campaignName: true, title: true } },
      navigationOffer: { select: { targetName: true, targetAddress: true } },
      items: {
        where: { isVisible: true },
        include: {
          navigationPoint: true,
          carrier: true,
          selectedPhoto: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  }));

  if (!report || !isPublicNavigationReportStatus(report.status)) {
    return NextResponse.json({ error: 'Požadovaná fotodokumentace nebyla nalezena nebo není publikována.' }, { status: 404 });
  }

  if (!report.tokenExpiresAt || new Date() > report.tokenExpiresAt) {
    return NextResponse.json({ error: 'Platnost přístupového odkazu vypršela. Vyžádejte si prosím nový odkaz.' }, { status: 410 });
  }

  const items: SnapshotItemData[] = report.items.map((item) => {
    let baseItem: SnapshotItemData;
    if (item.snapshot && typeof item.snapshot === 'object') {
      baseItem = { ...(item.snapshot as SnapshotItemData) };
    } else {
      baseItem = buildSnapshotItem({
        id: item.id,
        clientNote: item.clientNote,
        navigationPoint: item.navigationPoint,
        carrier: item.carrier,
        selectedPhoto: item.selectedPhoto,
      });
    }

    baseItem.photoUrl = null;
    if (item.selectedPhotoId && isClientApprovedPhoto(item.selectedPhoto)) {
      baseItem.photoUrl = `/api/client/navigation-documentation/${encodeURIComponent(token)}/photos/${encodeURIComponent(item.selectedPhotoId)}`;
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
