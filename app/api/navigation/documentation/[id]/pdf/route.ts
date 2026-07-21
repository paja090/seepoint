import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { buildSnapshotItem, SnapshotItemData } from '@/lib/navigation-documentation';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;

  const report = await prisma.navigationDocumentationReport.findUnique({
    where: { id },
    include: {
      client: true,
      offer: true,
      navigationOffer: true,
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
  });

  if (!report) {
    return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
  }

  const items: SnapshotItemData[] = report.items.map((item) => {
    if (item.snapshot && typeof item.snapshot === 'object') {
      return item.snapshot as SnapshotItemData;
    }
    return buildSnapshotItem({
      id: item.id,
      clientNote: item.clientNote,
      navigationPoint: item.navigationPoint,
      carrier: item.carrier,
      selectedPhoto: item.selectedPhoto,
    });
  });

  return NextResponse.json({
    reportId: report.id,
    title: report.title,
    clientName: report.client.name,
    campaignTitle: report.offer?.campaignName || report.title,
    quarter: report.quarter,
    year: report.year,
    publishedAt: report.publishedAt || report.createdAt,
    items,
  });
}
