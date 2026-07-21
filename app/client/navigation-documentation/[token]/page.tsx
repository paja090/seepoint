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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-center text-white font-sans">
        <div className="max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-2xl space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="SeePOINT Logo" className="h-10 w-auto mx-auto bg-white/90 p-1.5 rounded-xl" src="/seepoint-logo.svg" />
          <h1 className="text-xl font-bold text-sky-400">Ukázkový náhled fotodokumentace</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Toto je testovací náhled e-mailového odkazu. Pro zobrazení živé fotodokumentace vašich navigačních nosičů použijte unikátní odkaz odeslaný v oficiálním e-mailu.
          </p>
        </div>
      </div>
    );
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

  if (!report || report.status === 'ARCHIVED') {
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

    if (item.selectedPhotoId) {
      baseItem.photoUrl = `/api/client/navigation-documentation/${encodeURIComponent(token)}/photos/${encodeURIComponent(item.selectedPhotoId)}`;
    }

    return baseItem;
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
