import { notFound } from 'next/navigation';
import { PublicNavigationClientView } from '@/components/navigation-documentation/PublicNavigationClientView';
import { hashToken, buildSnapshotItem, SnapshotItemData } from '@/lib/navigation-documentation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PublicNavigationDocumentationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) {
    notFound();
  }

  const tokenHash = hashToken(token);

  const report = await prisma.navigationDocumentationReport.findUnique({
    where: { publicTokenHash: tokenHash },
    include: {
      client: { select: { name: true, logoFileName: true } },
      offer: { select: { campaignName: true, title: true } },
      navigationOffer: { select: { targetName: true } },
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

  if (!report || report.status === 'ARCHIVED' || report.status === 'DRAFT') {
    notFound();
  }

  if (report.tokenExpiresAt && new Date() > report.tokenExpiresAt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-6 text-center text-slate-800">
        <h1 className="text-2xl font-bold">Platnost odkazu vypršela</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-md">
          Platnost tohoto přístupového odkazu pro fotodokumentaci vypršela ({new Date(report.tokenExpiresAt).toLocaleDateString('cs-CZ')}). Vyžádejte si prosím novou fotodokumentaci.
        </p>
      </div>
    );
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

  const campaignTitle = report.offer?.campaignName || report.offer?.title || report.navigationOffer?.targetName || report.title;

  return (
    <PublicNavigationClientView
      reportData={{
        title: report.title,
        description: report.description,
        quarter: report.quarter,
        year: report.year,
        publishedAt: (report.publishedAt || report.createdAt).toISOString(),
        clientName: report.client.name,
        clientLogoUrl: report.client.logoFileName ? `/api/proposals/${encodeURIComponent(token)}/logo` : null,
        campaignTitle,
        itemsCount: items.length,
        items,
      }}
    />
  );
}
