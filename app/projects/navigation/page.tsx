import {
  Camera,
  ChevronRight,
  Compass,
  FileText,
  FolderKanban,
  Globe,
  MapPinned,
  Plus,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NavigationProjectsPage() {
  await requirePageAccess('navigationProjects');

  const [offers, reports] = await Promise.all([
    prisma.offer.findMany({
      where: { offerType: 'NAVIGATION', archivedAt: null },
      select: {
        id: true,
        campaignName: true,
        status: true,
        updatedAt: true,
        client: { select: { name: true } },
        navigationOffer: {
          select: {
            targetName: true,
            _count: { select: { points: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.navigationDocumentationReport.findMany({
      where: { status: { not: 'ARCHIVED' } },
      include: {
        client: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  const publishedReportsCount = reports.filter((r) => r.status === 'PUBLISHED' || r.status === 'SENT').length;

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header Section */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-700">Projekty</p>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">
                Navigace & Dokumentace
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Projekty Navigace</h1>
            <p className="mt-2 text-sm text-slate-500">
              Správa navigačních nabídek, tras, cílů a kvartální fotodokumentace pro klienty.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition"
              href="/navigation/documentation"
            >
              <Camera size={16} /> Fotodokumentace navigací
            </Link>

            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
              href="/offers/new/navigation"
            >
              <Plus size={16} /> Nová nabídka navigace
            </Link>
          </div>
        </header>

        {/* PROMINENT FEATURE CARD: Fotodokumentace Navigací */}
        <section className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-lg">
          {/* Subtle background glow circle */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/20 border border-sky-400/30 px-3 py-1 text-xs font-bold text-sky-300">
                  <Sparkles size={13} className="text-sky-300" /> Kvartální modul
                </span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                  Aktivní
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Fotodokumentace Navigací
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 max-w-xl">
                  Generujte oficiální kvartální zprávy o stavu navigačních značek pro klienty. Automatický veřejný odkaz bez přihlášení, mapa s GPS souřadnicemi a úprava směru nosičů.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/navigation/documentation"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-400 transition"
                >
                  <Camera size={16} /> Otevřít Fotodokumentace →
                </Link>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-300 pl-2">
                  <span className="flex items-center gap-1.5">
                    <FileText size={15} className="text-sky-400" /> {reports.length} reportů celkem
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Globe size={15} className="text-emerald-400" /> {publishedReportsCount} publikovaných odkazů
                  </span>
                </div>
              </div>
            </div>

            {/* Quick List of Recent Documentation Reports */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">Poslední kvartální reporty</span>
                <Link href="/navigation/documentation" className="text-[11px] font-semibold text-slate-300 hover:text-white transition">
                  Zobrazit vše →
                </Link>
              </div>

              {reports.length > 0 ? (
                <div className="space-y-2">
                  {reports.slice(0, 3).map((rep) => (
                    <Link
                      key={rep.id}
                      href="/navigation/documentation"
                      className="group flex items-center justify-between rounded-xl bg-white/5 p-3 hover:bg-white/10 transition border border-white/5"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <strong className="block truncate text-xs font-bold text-white group-hover:text-sky-300 transition">
                          {rep.title}
                        </strong>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {rep.client.name} · {rep.quarter ? `${rep.quarter}. čtvrtletí ` : ''}{rep.year} ({rep._count.items} položek)
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">Zatím nebyly vytvořeny žádné kvartální reporty.</p>
              )}
            </div>
          </div>
        </section>

        {/* Main Content Grid: Offers Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={18} className="text-sky-700" />
              <h2 className="text-lg font-bold text-slate-950">Navigační projekty a nabídky ({offers.length})</h2>
            </div>

            <Link
              href="/offers/new/navigation"
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
            >
              + Vytvořit nabídku
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {offers.length ? (
              <ul className="divide-y divide-slate-100">
                {offers.map((offer) => (
                  <li key={offer.id}>
                    <Link
                      className="flex items-center gap-4 p-5 transition hover:bg-slate-50/80"
                      href={`/offers/${offer.id}`}
                    >
                      <span className="rounded-xl bg-sky-50 p-3 text-sky-700 border border-sky-100">
                        <MapPinned size={20} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-bold text-slate-900">
                          {offer.campaignName}
                        </strong>
                        <span className="mt-1 block text-xs text-slate-500 font-medium">
                          {offer.client.name} · {offer.navigationOffer?.targetName ?? 'Cíl neuveden'} · {offer.navigationOffer?._count.points ?? 0} bodů
                        </span>
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {offer.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-12 text-center">
                <Compass className="mx-auto text-slate-300" size={40} />
                <h3 className="mt-3 font-bold text-slate-800">Zatím bez navigačních nabídek</h3>
                <p className="mt-1 text-xs text-slate-500">
                  První navigační projekt vznikne vytvořením nové nabídky navigace.
                </p>
                <Link
                  href="/offers/new/navigation"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Plus size={15} /> Vytvořit nabídku navigace
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
