import Link from 'next/link';
import { BarChart3, Building2, CalendarClock, DollarSign, Layers, PieChart, Sparkles, Tag, TrendingUp } from 'lucide-react';
import { EmptyState, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

interface ManagerDashboardProps {
  totalSurfaces: number;
  availableSurfaces: number;
  occupiedSurfaces: number;
  knownMonthlyRent: number;
  annualizedKnownRent: number;
  pricedOccupiedSurfaces: number;
  unpricedOccupiedSurfaces: number;
  occupancyPercent: number;
  waitingOffers: number;
  seasonalityData: number[];
  ending7: Array<{
    id: string;
    campaignName: string;
    clientName: string;
    dateTo: Date;
    status: string;
    client: { name: string } | null;
    surface: { carrier: { code: string; city: string } };
  }>;
  mediaBreakdown: Array<{
    type: string;
    label: string;
    count: number;
    occupiedCount: number;
    occupancyPercent: number;
    knownMonthlyRent: number;
  }>;
  topCities: Array<{
    city: string;
    total: number;
    occupied: number;
    percent: number;
  }>;
}

export function ManagerDashboard({
  totalSurfaces,
  availableSurfaces,
  occupiedSurfaces,
  knownMonthlyRent,
  annualizedKnownRent,
  pricedOccupiedSurfaces,
  unpricedOccupiedSurfaces,
  occupancyPercent,
  waitingOffers,
  seasonalityData,
  ending7,
  mediaBreakdown,
  topCities,
}: ManagerDashboardProps) {
  const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  const maxSeasonalityVal = Math.max(...seasonalityData, 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manažerský Dashboard & Provozní Analytika"
        description="Přehled kapacity, kampaní a explicitně evidovaného nájemného bez dopočítaných cenových odhadů."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/occupancy" className="btn-primary">
              Obsazenost nosičů
            </Link>
            <Link href="/offers" className="btn-secondary">
              Vytvořit nabídku
            </Link>
          </div>
        }
      />

      {/* Financial & Revenue Highlights */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-200">Evidované měsíční nájemné</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black">{knownMonthlyRent.toLocaleString('cs-CZ')} Kč</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-200">
            <TrendingUp size={14} />
            <span>{pricedOccupiedSurfaces} obsazených ploch s explicitní cenou</span>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 text-white shadow-lg border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Roční přepočet evidovaného nájemného</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black">{annualizedKnownRent.toLocaleString('cs-CZ')} Kč</p>
          <p className="mt-2 text-xs text-slate-400 font-medium">12× měsíční hodnota; {unpricedOccupiedSurfaces} obsazených ploch bez ceny</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Celková obsazenost</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <PieChart size={20} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-950">{occupancyPercent} %</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${occupancyPercent}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">{occupiedSurfaces} z {totalSurfaces}</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Čekající nabídky</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Tag size={20} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-950">{waitingOffers} ks</p>
          <p className="mt-2 text-xs text-slate-500 font-medium">Odeslané nabídky klientům v databázi</p>
        </div>
      </div>

      {/* AI Smart Business Insights */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl border border-indigo-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-white font-black shadow-lg shadow-indigo-500/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Inteligentní Systémová Doporučení & Alerting</h2>
            <p className="text-xs text-indigo-300">Živá databázová analýza kapacity a obsazenosti nosičů</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <CalendarClock size={15} />
              <span>Končící rezervace</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {ending7.length} kampaním končí rezervace do 7 dnů!
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Spusťte předrezervaci pro další klienty v Plánu práce.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
              <TrendingUp size={15} />
              <span>Nejžádanější město</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {topCities[0]?.city || 'Ostrava'} vykazuje obsazenost {topCities[0]?.percent || 0} %
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Celkem {topCities[0]?.occupied || 0} obsazených ploch z {topCities[0]?.total || 0} v lokalitě.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1">
              <BarChart3 size={15} />
              <span>Volná kapacita k nabídce</span>
            </div>
            <p className="text-sm font-semibold text-white">
              K dispozici je {availableSurfaces} volných reklamních nosičů
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Dostupné pro 1-klikovou rezervaci v modulu Obsazenost.
            </p>
          </div>
        </div>
      </div>

      {/* Seasonality & Monthly Trend Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                <span>Sezonalita & Počet Kampaní v Roce (Reálná Data)</span>
              </h2>
              <p className="text-xs text-slate-500">Měsíční rozložení aktivních smluv ze systémové databáze</p>
            </div>
            <span className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              Rok {new Date().getFullYear()}
            </span>
          </div>

          {/* SVG Visual Bar Chart */}
          <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2 border-b border-slate-100">
            {months.map((m, idx) => {
              const val = seasonalityData[idx] || 0;
              const heightPercent = Math.max(5, Math.round((val / maxSeasonalityVal) * 100));
              const isHigh = heightPercent >= 70;

              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white z-10 whitespace-nowrap pointer-events-none shadow-md">
                    {m}: {val} kampaní
                  </div>

                  <div className="w-full flex items-end justify-center h-48 bg-slate-50 rounded-t-xl overflow-hidden p-1">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${isHigh ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-gradient-to-t from-indigo-600 to-sky-400'}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">
                    {m.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Měsíce s nejvyšší intenzitou smluv
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-3 w-3 rounded-full bg-indigo-500" />
              Standardní provoz
            </span>
          </div>
        </div>

        {/* Media Type Breakdown */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2 mb-1">
            <Layers className="text-emerald-600" size={20} />
            <span>Struktura médií & Evidované nájemné</span>
          </h2>
          <p className="text-xs text-slate-500 mb-6">Rozdělení z reálné databáze nosičů</p>

          <div className="space-y-4">
            {mediaBreakdown.map((item) => (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-950">{item.label}</span>
                  <span className="font-semibold text-slate-600">{item.occupiedCount} z {item.count} ks ({item.occupancyPercent} %)</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${item.occupancyPercent}%` }}
                  />
                </div>
                <p className="text-[11px] font-semibold text-emerald-700 text-right">
                  {item.knownMonthlyRent.toLocaleString('cs-CZ')} Kč / měsíc
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Overview Tables */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Kampaně končící do 7 dnů</h2>
              <p className="text-xs text-slate-500">{ending7.length} kampaní vyžaduje rozhodnutí o prodloužení.</p>
            </div>
            <CalendarClock className="text-orange-500" size={22} />
          </div>
          {ending7.length === 0 ? (
            <EmptyState title="Žádné kampaně nekončí do 7 dnů." />
          ) : (
            <Table minWidth="min-w-[500px]">
              <TableHead>
                <tr>
                  <TableHeaderCell>Kampaň / Klient</TableHeaderCell>
                  <TableHeaderCell>Nosič</TableHeaderCell>
                  <TableHeaderCell>Konec</TableHeaderCell>
                  <TableHeaderCell>Stav</TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {ending7.map((item) => (
                  <tr key={item.id}>
                    <TableCell>
                      <b>{item.campaignName}</b>
                      <br />
                      <span className="text-slate-500 text-xs">{item.client?.name ?? item.clientName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{item.surface.carrier.code}</span>
                      <br />
                      <span className="text-slate-500 text-xs">{item.surface.carrier.city}</span>
                    </TableCell>
                    <TableCell>{new Date(item.dateTo).toLocaleDateString('cs-CZ')}</TableCell>
                    <TableCell><StatusBadge value={item.status} /></TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        {/* City Leaderboard */}
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Top Města dle Vytížení (Reálná Data)</h2>
              <p className="text-xs text-slate-500">Nejžádanější lokality s počtem obsazených nosičů</p>
            </div>
            <Building2 className="text-blue-600" size={22} />
          </div>

          <div className="space-y-3">
            {topCities.map((c) => (
              <div key={c.city} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div>
                  <p className="font-bold text-slate-950 text-sm">{c.city}</p>
                  <p className="text-xs text-slate-500">{c.occupied} obsazeno z {c.total} nosičů v lokalitě</p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-900">
                    {c.percent} %
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
