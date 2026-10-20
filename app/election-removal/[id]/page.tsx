import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import { PostponeRouteButton } from '@/components/election-removal/PostponeRouteButton';
import { ReleaseWorkPanel } from '@/components/election-removal/ReleaseWorkPanel';
import { FieldWorkDesk } from '@/components/election-removal/FieldWorkDesk';
import { CampaignPhotoAlbum } from '@/components/election-removal/CampaignPhotoAlbum';
import { DuplicateCampaignButton } from '@/components/election-removal/DuplicateCampaignButton';
import { buildCampaignAlbumSlug } from '@/lib/election-removal/album-token';
import { resolvePointClientName } from '@/lib/election-removal/point-metadata';
import { Route, ArrowLeft, Truck, Calendar, Camera, Sparkles, BriefcaseBusiness } from 'lucide-react';

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

  const totalPoints = campaign.points.length;
  const completedPoints = campaign.points.filter((p) => p.status === 'COMPLETED').length;
  const plannedPoints = campaign.points.filter((p) => p.assignedFieldPlanId || p.status === 'IN_PROGRESS').length;
  const pendingPoints = campaign.points.filter((p) => !p.assignedFieldPlanId && p.status !== 'COMPLETED').length;

  const pointsForAlbum = campaign.points.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    layerName: p.layerName,
    clientName: resolvePointClientName(p, campaign.clientName),
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
                <Link
                  href={`/election-removal/${campaign.id}/plan`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs"
                  title="Spustit AI plánování trasy a výjezdu"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>⚡ Naplánovat trasu (AI)</span>
                </Link>
              )}

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
                href="/work"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs"
                title="Přejít do celkového Plánu práce"
              >
                <BriefcaseBusiness className="w-3.5 h-3.5 text-slate-500" />
                <span>Plán práce</span>
              </Link>

              <Link
                href={`/fotodokumentace?albumId=${campaign.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs"
                title="Otevřít v centrální fotodokumentaci"
              >
                <Camera className="w-3.5 h-3.5 text-sky-600" />
                <span>Všechna fotoalba</span>
              </Link>

              <Link
                href="/my-route"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs"
              >
                <Route className="w-3.5 h-3.5" />
                <span>Moje trasa</span>
              </Link>
            </div>
          </header>
        </div>

        {canManage && <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Předat jednotlivé body do jiné trasy</summary><ReleaseWorkPanel campaignId={id} points={campaign.points} /></details>}
        {/* Quick Summary Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Celkem prací</span>
            <div className="text-xl font-black text-slate-900">{totalPoints}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-center">
            <span className="text-[11px] font-semibold text-amber-700 uppercase">K naplánování</span>
            <div className="text-xl font-black text-amber-900">{pendingPoints}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 text-center">
            <span className="text-[11px] font-semibold text-sky-700 uppercase">V trasách</span>
            <div className="text-xl font-black text-sky-900">{plannedPoints}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase">Dokončeno</span>
            <div className="text-xl font-black text-emerald-900">{completedPoints}</div>
          </div>
        </div>

        {/* Trips History Dropdown */}
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" open={campaign.fieldPlans.length > 0}>
          <summary className="cursor-pointer font-medium text-sm text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Plánované výjezdy a trasy ({campaign.fieldPlans.length})</span>
            </span>
            <span className="text-xs text-slate-400">Kliknutím rozbalit/sbalit</span>
          </summary>
          <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t border-slate-100">
            {campaign.fieldPlans.length === 0 ? (
              <p className="text-xs text-slate-500">Zatím nebyl naplánován žádný výjezd.</p>
            ) : (
              campaign.fieldPlans.map((p) => (
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs space-y-1.5 min-w-[220px]" key={p.id}>
                  <p className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Výjezd {p.date} / v{p.version}</span>
                    <span className="font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </p>
                  {canManage && ['APPROVED', 'ACTIVE'].includes(p.status) && <PostponeRouteButton planId={p.id} />}
                  {['APPROVED', 'ACTIVE'].includes(p.status) && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                      <Link
                        className="text-sky-600 font-semibold hover:underline"
                        href={`/election-removal/${id}/plan?parentPlanId=${p.id}`}
                      >
                        Revize trasy →
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link
                        className="text-slate-600 font-semibold hover:underline"
                        href="/work/route"
                        title="Zobrazit v denním přehledu Pracovní výjezd"
                      >
                        Plán práce →
                      </Link>
                    </div>
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
          createdAt={campaign.createdAt}
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
