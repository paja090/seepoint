import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { FieldWorkDesk } from '@/components/election-removal/FieldWorkDesk';
import { CampaignPhotoAlbum } from '@/components/election-removal/CampaignPhotoAlbum';
import { DuplicateCampaignButton } from '@/components/election-removal/DuplicateCampaignButton';
import { buildCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { Route, ArrowLeft, Truck, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FieldActionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await checkElectionRemovalPageAccess();
  const { id } = await params;

  const campaign = await prisma.electionCampaign.findFirst({
    where: { id, organizationId: user.organization!.id },
    include: {
      points: {
        include: {
          steps: { orderBy: { sequence: 'asc' } },
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
              fieldWorkStepId: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      fieldPlans: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!campaign) notFound();

  const canManage = ['ADMIN', 'MANAGER'].includes(user.role);

  const statusLabels: Record<string, string> = {
    DRAFT: 'Návrh',
    PLANNED: 'Naplánováno',
    IN_PROGRESS: 'Probíhá',
    COMPLETED: 'Hotovo',
    ARCHIVED: 'Archivováno',
    APPROVED: 'Schváleno',
    ACTIVE: 'Probíhá',
    SUPERSEDED: 'Nahrazeno',
    CANCELLED: 'Zrušeno',
  };

  const pointsForAlbum = campaign.points.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    quantity: p.quantity,
    operationType: p.operationType,
    latitude: p.latitude,
    longitude: p.longitude,
    photos: p.photos.map((ph) => ({
      id: ph.id,
      url: `/api/photos/${encodeURIComponent(ph.id)}/file`,
      type: ph.type,
      fileName: ph.fileName,
      createdAt: ph.createdAt,
      capturedLatitude: ph.capturedLatitude,
      capturedLongitude: ph.capturedLongitude,
      capturedByWorkerName: ph.capturedByWorkerName,
      fieldWorkStepId: ph.fieldWorkStepId,
    })),
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Navigation & Header */}
        <div className="space-y-3">
          <Link
            href="/election-removal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zpět na Terénní práce</span>
          </Link>

          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-sky-50 text-sky-700">
                  <Truck className="w-5 h-5" />
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {statusLabels[campaign.status] ?? campaign.status}
                </span>
                {campaign.clientName && (
                  <span className="text-xs text-slate-500 font-medium">
                    Klient: {campaign.clientName}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                {campaign.name}
              </h1>

              {campaign.description && (
                <p className="text-sm text-slate-500 mt-1">
                  {campaign.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {canManage && (
                <DuplicateCampaignButton
                  campaignId={campaign.id}
                  campaignName={campaign.name}
                  clientName={campaign.clientName}
                  totalPoints={campaign.points.length}
                  variant="header"
                />
              )}

              <Link
                href="/my-route"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition shadow-sm"
              >
                <Route className="w-3.5 h-3.5" />
                <span>Moje trasa</span>
              </Link>
            </div>
          </header>
        </div>

        {/* Trips History Dropdown */}
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-medium text-sm text-slate-800 flex items-center justify-between">
            <span>Plánované výjezdy a historie ({campaign.fieldPlans.length})</span>
            <span className="text-xs text-slate-400">Kliknutím rozbalit</span>
          </summary>
          <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t border-slate-100">
            {campaign.fieldPlans.length === 0 ? (
              <p className="text-xs text-slate-500">Zatím nebyl naplánován žádný výjezd.</p>
            ) : (
              campaign.fieldPlans.map((p) => (
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs space-y-1" key={p.id}>
                  <p className="font-bold text-slate-800">
                    Výjezd {p.date} / v{p.version}
                  </p>
                  <p className="text-slate-500">
                    Stav: <span className="font-medium text-slate-700">{statusLabels[p.status] ?? p.status}</span>
                  </p>
                  {['APPROVED', 'ACTIVE'].includes(p.status) && (
                    <Link
                      className="text-sky-600 font-semibold hover:underline block pt-1"
                      href={`/election-removal/${id}/plan?parentPlanId=${p.id}`}
                    >
                      Revize tohoto výjezdu →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </details>

        {/* Campaign Photo Album */}
        <CampaignPhotoAlbum
          campaignId={id}
          albumSlug={buildCampaignAlbumSlug(id)}
          campaignName={campaign.name}
          clientName={campaign.clientName}
          points={pointsForAlbum}
        />

        {/* Dispatcher Task Management Desk */}
        {canManage && (
          <div className="pt-2">
            <FieldWorkDesk campaignId={id} points={campaign.points} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
