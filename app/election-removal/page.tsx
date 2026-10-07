import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { checkElectionRemovalPageAccess } from '@/lib/election-removal/guard';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Plus,
  Route,
  Vote,
} from 'lucide-react';
import { DeleteCampaignButton } from '@/components/election-removal/DeleteCampaignButton';

export const dynamic = 'force-dynamic';

export default async function ElectionRemovalPage() {
  const user = await checkElectionRemovalPageAccess();

  const campaigns = await prisma.electionCampaign.findMany({
    where: {
      organizationId: user.organization!.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      _count: {
        select: {
          points: true,
          fieldPlans: true,
        },
      },
    },
  });

  // Calculate totals
  const totalCampaigns = campaigns.length;
  const totalPoints = campaigns.reduce((acc, c) => acc + c.totalPoints, 0);
  const totalCompleted = campaigns.reduce((acc, c) => acc + c.completedPoints, 0);

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                Interní modul SeePoint
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Vote className="w-7 h-7 text-sky-600" />
              Volební demontáže
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Plánování, rozdělení do tras a realizace demontáže volebních reklamních nosičů po kampaních.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/election-removal/new"
              className="btn btn-primary text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nová akce (Import KML)</span>
            </Link>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Celkem kampaní
              </p>
              <Vote className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {totalCampaigns}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Registrované demontážní akce
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Nosičů k demontáži
              </p>
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {totalPoints} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Fyzických médií ze všech kampaní
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dokončeno
              </p>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              {totalCompleted} ks
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Úspěšně demontováno a ověřeno
            </p>
          </div>
        </div>

        {/* Campaign List */}
        {campaigns.length === 0 ? (
          <div className="card text-center py-16 px-4 space-y-4 border-dashed border-2 border-slate-200">
            <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 mx-auto flex items-center justify-center">
              <Vote className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                Zatím nebyla vytvořena žádná volební demontáž
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Nahrajte KML export z Google My Maps, zkontrolujte vrstvy médií a naplánujte demontážní trasy pro vaše týmy.
              </p>
            </div>
            <Link
              href="/election-removal/new"
              className="btn btn-primary text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Založit první kampaň z KML</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Přehled kampaní
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const percentDone =
                  c.totalPoints > 0
                    ? Math.round((c.completedPoints / c.totalPoints) * 100)
                    : 0;

                return (
                  <div
                    key={c.id}
                    className="card p-5 hover:shadow-md transition hover:border-sky-300 space-y-4 group relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/election-removal/${c.id}`}
                          className="font-bold text-slate-900 group-hover:text-sky-600 transition block truncate text-base hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.targetDate && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(c.targetDate).toLocaleDateString('cs-CZ')}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {c.status}
                        </span>
                        <DeleteCampaignButton
                          campaignId={c.id}
                          campaignName={c.name}
                          variant="icon"
                        />
                      </div>
                    </div>

                    {c.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {c.description}
                      </p>
                    )}

                    {/* Progress */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>Postup demontáže</span>
                        <span>
                          {c.completedPoints} / {c.totalPoints} ks ({percentDone} %)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${percentDone}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Route className="w-3.5 h-3.5 text-slate-400" />
                        {c._count.fieldPlans} tras
                      </span>
                      <Link
                        href={`/election-removal/${c.id}`}
                        className="text-sky-600 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-1"
                      >
                        <span>Detail kampaně</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
