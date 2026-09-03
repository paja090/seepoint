import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Compass, MapPin, Search, Plus, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type SurveyListItem = {
  id: string;
  isOffer?: boolean;
  targetName: string;
  targetAddress?: string | null;
  crmOrderId: string;
  crmOrder?: { client?: { name: string } | null } | null;
  candidatePoints: Array<{ id: string; supervisionStatus: string; createdAt: Date }>;
  surveyRoutes: Array<{ id: string }>;
  updatedAt: Date;
};

export default async function MobileSurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string }>;
}) {
  await requirePageAccess('navigationProjects');
  const user = await getCurrentUser();
  const { search = '', filter = 'all' } = await searchParams;

  let orders: SurveyListItem[] = [];
  let fetchError: string | null = null;

  try {
    const whereCondition: Prisma.NavigationOrderWhereInput = {};

    if (search.trim()) {
      whereCondition.OR = [
        { targetName: { contains: search, mode: 'insensitive' } },
        { targetAddress: { contains: search, mode: 'insensitive' } },
        { crmOrder: { client: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (filter === 'my' && user) {
      whereCondition.OR = [
        { installerUserId: user.id },
        { candidatePoints: { some: { createdByUserId: user.id } } },
      ];
    } else if (filter === 'pendingReview') {
      whereCondition.candidatePoints = {
        some: { supervisionStatus: 'PENDING_REVIEW' },
      };
    }

    const navOrders = await prisma.navigationOrder.findMany({
      where: whereCondition,
      include: {
        crmOrder: {
          include: {
            client: { select: { name: true, tradingName: true } },
          },
        },
        surveyRoutes: { where: { active: true } },
        candidatePoints: {
          select: { id: true, supervisionStatus: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const navOffers = await prisma.offer.findMany({
      where: {
        offerType: 'NAVIGATION',
        ...(search.trim()
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { navigationOffer: { targetName: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { name: true, tradingName: true } },
        navigationOffer: {
          include: {
            points: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const mappedOffers: SurveyListItem[] = navOffers.map((offer) => ({
      id: offer.id,
      isOffer: true,
      targetName: offer.navigationOffer?.targetName || offer.title || 'Navigační nabídka',
      targetAddress: offer.navigationOffer?.targetAddress || null,
      crmOrderId: offer.id,
      crmOrder: {
        client: {
          name: offer.client?.name || offer.client?.tradingName || 'Klient',
        },
      },
      candidatePoints: (offer.navigationOffer?.points || []).map((point) => ({
        id: point.id,
        supervisionStatus: 'APPROVED',
        createdAt: point.createdAt,
      })),
      surveyRoutes: [],
      updatedAt: offer.updatedAt,
    }));

    orders = [...navOrders, ...mappedOffers].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err: unknown) {
    console.error('Error loading mobile surveys:', err);
    fetchError = err instanceof Error ? err.message : 'Nepodařilo se načíst průzkumy z databáze.';
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-4xl mx-auto pb-16 text-slate-900">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 rounded-3xl shadow-xl space-y-3 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Compass size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">📍 Průzkum lokalit</h1>
                <p className="text-xs text-slate-400">Terénní vyhledávání navigačních a reklamních bodů</p>
              </div>
            </div>

            <Link
              href="/navigation/installations"
              className="text-xs text-sky-300 font-bold hover:underline"
            >
              🔧 Montáže
            </Link>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pt-2 text-xs font-bold scrollbar-thin">
            <Link
              href="/mobile-surveys?filter=all"
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              Všechny projekty
            </Link>
            <Link
              href="/mobile-surveys?filter=my"
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'my'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              Moje projekty
            </Link>
            <Link
              href="/mobile-surveys?filter=pendingReview"
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === 'pendingReview'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              ⏳ Čeká na supervizi
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {fetchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>Chyba při komunikaci s databází: {fetchError}</span>
          </div>
        )}

        {/* Survey Project Cards */}
        <div className="space-y-3">
          {orders.length === 0 && !fetchError ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
              <Compass size={32} className="mx-auto text-slate-400" />
              <h3 className="font-extrabold text-slate-800 text-sm">Žádné zakázky pro průzkum nenalezeny</h3>
              <p className="text-xs text-slate-500">Pro zadaný filtr nebyly v databázi nalezeny žádné navigační zakázky.</p>
            </div>
          ) : (
            orders.map((o) => {
              const candidates = o.candidatePoints || [];
              const routes = o.surveyRoutes || [];
              const totalCandidates = candidates.length;
              const pendingReviewCount = candidates.filter((candidate) => candidate.supervisionStatus === 'PENDING_REVIEW').length;
              const approvedCount = candidates.filter((candidate) => candidate.supervisionStatus === 'APPROVED').length;

              return (
                <Link
                  key={o.id}
                  href={`/mobile-surveys/${o.id}`}
                  className="block bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-base text-slate-900 group-hover:text-emerald-700 transition truncate">
                          {o.targetName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${o.isOffer ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                          {o.isOffer ? '📄 NABÍDKA' : `Z-${(o.crmOrderId || '').slice(-4).toUpperCase()}`}
                        </span>
                      </div>
                      <p className="text-xs text-sky-700 font-bold">{o.crmOrder?.client?.name || 'Klient nezjištěn'}</p>
                      {o.targetAddress && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <MapPin size={12} className="text-amber-500 shrink-0" />
                          <span>{o.targetAddress}</span>
                        </p>
                      )}
                    </div>

                    <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition shrink-0">
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs font-bold">
                    <span className="text-slate-700">
                      Kandidáti: <strong className="text-slate-950 font-black">{totalCandidates}</strong>
                    </span>
                    {pendingReviewCount > 0 && (
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                        ⏳ {pendingReviewCount} ke kontrole
                      </span>
                    )}
                    {approvedCount > 0 && (
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                        ✓ {approvedCount} schváleno
                      </span>
                    )}
                    <span className="text-slate-500 ml-auto font-normal text-[11px]">
                      Trasy: {routes.length}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
