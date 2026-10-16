import Link from 'next/link';
import { MapPin, MapPinned, Plus, LayoutGrid, Table as TableIcon, ExternalLink, Navigation, Compass, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { CarrierFilters } from '@/components/CarrierFilters';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { carrierTypeLabel, mediaTypeLabel, parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrierFilterOptions, getCarriersPage } from '@/lib/db';
import { getActiveCarrierTypes } from '@/lib/carrier-type-catalog';
import { ProjectSubNav } from '@/components/navigation/ProjectSubNav';

export const dynamic = 'force-dynamic';

const inventoryNavItems = [
  { href: '/projects/city-inventory', label: '📊 Přehled & Nástěnka' },
  { href: '/carriers', label: '🪧 Evidence nosičů' },
  { href: '/occupancy', label: '📅 Obsazenost ploch' },
  { href: '/map', label: '🗺️ Mapa nosičů' },
];

const categoryTabs = [
  { id: 'ALL', label: 'Všechny nosiče', icon: '🪧', carrierType: undefined },
  { id: 'NAVIGATION', label: 'Navigační tabule (VO)', icon: '🧭', carrierType: 'NAVIGATION' },
  { id: 'BILLBOARD', label: 'Billboardy & Bigboardy', icon: '📐', carrierType: 'BILLBOARD' },
  { id: 'CITYLIGHT', label: 'Citylighty & Plakáty', icon: '🖼️', carrierType: 'CITYLIGHT' },
  { id: 'PROMO_BENCH', label: 'Lavičky & Mobiliář', icon: '🪑', carrierType: 'PROMO_BENCH' },
  { id: 'LED_SCREEN', label: 'LED Obrazovky', icon: '📺', carrierType: 'LED_SCREEN' },
];

function buildUrl(currentFilters: Record<string, unknown>, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged = { ...currentFilters, ...overrides };
  Object.entries(merged).forEach(([key, rawValue]) => {
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      params.set(key, String(rawValue));
    }
  });
  return `/carriers?${params.toString()}`;
}

function getDirectionArrow(direction?: string | null) {
  if (!direction) return '➔';
  const norm = direction.toLowerCase();
  if (norm.includes('vpravo') || norm.includes('doprava') || direction.includes('➔')) return '➔';
  if (norm.includes('vlevo') || norm.includes('doleva') || direction.includes('⬅')) return '⬅';
  if (norm.includes('rovne') || norm.includes('rovně') || norm.includes('primo') || norm.includes('přímo') || direction.includes('⬆')) return '⬆';
  return '🧭';
}

export default async function Carriers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageAccess('carriers');
  const rawParams = await searchParams;
  const filters = parseCarrierFilters(rawParams);
  const viewMode = filters.view === 'cards' ? 'cards' : 'table';
  const currentCategory = filters.carrierType ?? 'ALL';

  const [{ carriers, meta }, filterOptions, carrierTypes] = await Promise.all([
    getCarriersPage(filters),
    getCarrierFilterOptions(),
    getActiveCarrierTypes(),
  ]);

  const nextParams = new URLSearchParams();
  Object.entries({ ...filters, page: String((meta.page ?? 1) + 1), pageSize: String(meta.pageSize) }).forEach(([key, rawValue]) => {
    const value = typeof rawValue === 'number' ? String(rawValue) : rawValue;
    if (value) nextParams.set(key, value);
  });

  return (
    <AppShell>
      <ProjectSubNav items={inventoryNavItems} />

      <PageHeader
        title="Evidence reklamních nosičů"
        description="Kompletní evidence všech nosičů a sloupů VO. Rychle přepínejte mezi navigacemi, billboardy a mobiliářem."
        actions={
          <div className="flex items-center gap-2">
            <Button href="/map" variant="primary">
              <Plus size={16} className="mr-2" />
              Přidat v mapě
            </Button>
          </div>
        }
      />

      {/* 🧭 Category Navigation Tabs (Rozdělení podle typu nosičů) */}
      <section className="mb-4">
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/90">
          {categoryTabs.map((tab) => {
            const isActive = tab.carrierType ? filters.carrierType === tab.carrierType : !filters.carrierType;
            const tabUrl = buildUrl(filters as unknown as Record<string, unknown>, {
              carrierType: tab.carrierType,
              carrierTypeId: undefined,
              page: '1',
            });

            return (
              <Link
                key={tab.id}
                href={tabUrl}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                    : 'bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950 border border-slate-200/60 shadow-2xs'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span className="ml-1 rounded-full bg-slate-800 text-sky-300 px-2 py-0.5 text-[10px] font-black">
                    {meta.total}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 🔍 Filter Component */}
      <CarrierFilters action="/carriers" filters={filters} options={filterOptions} carrierTypes={carrierTypes} resultCount={meta.total} />

      {/* 📊 Summary & View Switcher Bar */}
      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <p>
            Zobrazeno <strong>{meta.returned}</strong> z <strong>{meta.total}</strong> nosičů.
            <span className="ml-2 text-slate-500 hidden md:inline">Stránka {meta.page}, limit {meta.limit}.</span>
          </p>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <p className="text-slate-500 text-xs">
            Bez GPS: <strong>{meta.missingGpsCount}</strong> · Archivovaných: <strong>{meta.archivedCount}</strong>
          </p>
          {meta.hasMore && (
            <Link className="font-semibold text-sky-700 hover:underline ml-2 text-xs" href={`/carriers?${nextParams.toString()}`}>
              Načíst další stránku →
            </Link>
          )}
        </div>

        {/* 📋 Table vs 🪧 Card View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <Link
            href={buildUrl(filters as unknown as Record<string, unknown>, { view: 'table' })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'table' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <TableIcon size={14} />
            <span>Tabulka</span>
          </Link>
          <Link
            href={buildUrl(filters as unknown as Record<string, unknown>, { view: 'cards' })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'cards' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <LayoutGrid size={14} />
            <span>Karty nosičů</span>
          </Link>
        </div>
      </section>

      {/* 🪧 Results: Empty State OR Table OR Cards */}
      {carriers.length === 0 ? (
        <section className="card p-8">
          <EmptyState
            title="Filtrům neodpovídá žádný nosič."
            description="Zkuste zrušit část filtrů nebo hledat podle jiného kódu, čísla sloupu, města či klienta."
          />
        </section>
      ) : viewMode === 'cards' ? (
        /* 🪧 CARD VIEW (KARTY NOSIČŮ) */
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {carriers.map((carrier) => {
            const isNavigation = carrier.type === 'NAVIGATION' || Boolean(carrier.structureCode);
            const clients = [...new Set(carrier.surfaces.map((s) => s.currentClient?.name).filter((name): name is string => Boolean(name)))];
            const hasGps = Boolean(carrier.latitude && carrier.longitude);
            const primaryPhoto = carrier.photos[0] ?? carrier.surfaces.flatMap((s) => s.photos)[0];
            const totalPhotos = new Set([
              ...carrier.photos.map((p) => p.id),
              ...carrier.surfaces.flatMap((s) => s.photos.map((p) => p.id)),
            ]).size;
            const isDamaged =
              carrier.photos.some((p) => p.type === 'DAMAGE') ||
              carrier.surfaces.some((s) => s.photos.some((p) => p.type === 'DAMAGE')) ||
              carrier.note?.includes('ZÁVADA');

            return (
              <article
                key={carrier.id}
                className={`rounded-3xl border bg-white shadow-sm overflow-hidden flex flex-col justify-between transition hover:shadow-md ${
                  carrier.archivedAt ? 'border-slate-200 bg-slate-50/60 opacity-80' : isDamaged ? 'border-rose-300 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              >
                {/* 📸 Top Photo Preview */}
                <div className="relative h-44 w-full bg-slate-950 overflow-hidden group">
                  {primaryPhoto ? (
                    <a href={primaryPhoto.url} target="_blank" rel="noreferrer" title="Zvětšit fotografii v plné velikosti">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={primaryPhoto.id ? `/api/photos/${encodeURIComponent(primaryPhoto.id)}/thumbnail` : primaryPhoto.url}
                        alt={carrier.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </a>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-100">
                      <ImageIcon size={28} className="text-slate-300 mb-1" />
                      <span>Bez fotografie nosiče</span>
                    </div>
                  )}

                  {/* Top floating badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-lg bg-slate-950/90 text-white font-mono px-2.5 py-1 text-xs font-black shadow-md border border-slate-700">
                      {carrier.code}
                    </span>
                    {carrier.structureCode && (
                      <span className="rounded-lg bg-sky-600 text-white px-2 py-1 text-xs font-black shadow-md border border-sky-400">
                        ⚡ Sloup #{carrier.structureCode}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex flex-wrap items-center gap-1.5">
                    {totalPhotos > 0 && (
                      <span className="rounded-lg bg-slate-950/80 text-white px-2 py-0.5 text-[11px] font-bold shadow-md">
                        📸 {totalPhotos}
                      </span>
                    )}
                    {isDamaged && (
                      <span className="rounded-lg bg-rose-600 text-white px-2 py-0.5 text-[11px] font-black shadow-md animate-pulse">
                        🚨 ZÁVADA
                      </span>
                    )}
                  </div>

                  {primaryPhoto && (
                    <a
                      href={primaryPhoto.url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-2 right-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-white px-2 py-1 text-[11px] font-bold shadow-md flex items-center gap-1"
                    >
                      <span>Otevřít fotku</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-950 leading-tight">
                          <Link href={`/carriers/${carrier.id}`} className="hover:text-sky-700 hover:underline">
                            {carrier.name}
                          </Link>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {carrier.carrierTypeRef?.name || carrierTypeLabel(carrier.type)} · {carrier.city}
                        </p>
                      </div>
                      <StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} />
                    </div>

                    {/* 📍 Adresa */}
                    <p className="text-xs text-slate-700 font-medium flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <MapPin size={14} className="text-sky-600 shrink-0" />
                      <span className="truncate">
                        {[carrier.street ?? carrier.address, carrier.locality ?? carrier.cadastralArea, carrier.city].filter(Boolean).join(', ') || 'Adresa neuvedena'}
                      </span>
                    </p>

                    {/* 🧭 GPS Pozice */}
                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800 font-bold">
                        <Navigation size={13} className="text-rose-500 shrink-0" />
                        <span>
                          {hasGps ? `${carrier.latitude!.toFixed(5)}, ${carrier.longitude!.toFixed(5)}` : '⚠️ GPS chybí'}
                        </span>
                      </div>
                      {hasGps && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${carrier.latitude},${carrier.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-sky-700 hover:underline flex items-center gap-1 text-[11px]"
                          title="Navigovat na místo"
                        >
                          <span>Navigovat 🗺️</span>
                        </a>
                      )}
                    </div>

                    {/* 🧭 Navigační plochy & Klienti na sloupu */}
                    {carrier.surfaces.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isNavigation ? 'Navigační pozice na sloupu:' : 'Reklamní plochy:'}
                        </span>
                        <div className="space-y-1">
                          {carrier.surfaces.map((s) => {
                            const arrow = getDirectionArrow(s.directionDescription);
                            return (
                              <div
                                key={s.id}
                                className="flex items-center justify-between text-xs p-1.5 px-2 rounded-lg bg-slate-100/70 border border-slate-200/60"
                              >
                                <span className="font-semibold text-slate-900 truncate">
                                  {isNavigation && (s.directionDescription || s.destinationName) ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-sky-700 font-black">{arrow}</span>
                                      <span>{s.destinationName || s.name}</span>
                                    </span>
                                  ) : (
                                    s.name
                                  )}
                                </span>
                                <span className="text-[11px] shrink-0 font-bold ml-2">
                                  {s.currentClient ? (
                                    <span className="text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                                      {s.currentClient.name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Volné</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                    <Link
                      href={`/carriers/${carrier.id}`}
                      className="flex-1 text-center py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition shadow-2xs"
                    >
                      Detail nosiče
                    </Link>
                    {isNavigation && (
                      <Link
                        href={`/navigation/carriers/${carrier.id}`}
                        className="py-2 px-3 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-xs transition"
                        title="Časová osa a audit historie"
                      >
                        📜 Audit
                      </Link>
                    )}
                    <Link
                      href={`/map?carrier=${carrier.id}`}
                      className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                      title="Zobrazit na mapě"
                    >
                      <MapPinned size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        /* 📋 TABLE VIEW */
        <section className="card !p-0 overflow-hidden border border-slate-200 shadow-sm">
          <Table minWidth="min-w-[1240px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Kód & Sloup VO</TableHeaderCell>
                <TableHeaderCell>Fotka</TableHeaderCell>
                <TableHeaderCell>Název nosiče</TableHeaderCell>
                <TableHeaderCell>Pozice (GPS)</TableHeaderCell>
                <TableHeaderCell>Město & Adresa</TableHeaderCell>
                <TableHeaderCell>Klient & Navigace</TableHeaderCell>
                <TableHeaderCell>Stav nosiče</TableHeaderCell>
                <TableHeaderCell>Obsazenost</TableHeaderCell>
                <TableHeaderCell>Akce</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {carriers.map((carrier) => {
                const isNavigation = carrier.type === 'NAVIGATION' || Boolean(carrier.structureCode);
                const clients = [...new Set(carrier.surfaces.map((s) => s.currentClient?.name).filter((name): name is string => Boolean(name)))];
                const surfaceStatuses = [...new Set(carrier.surfaces.map((surface) => surface.status))];
                const hasGps = Boolean(carrier.latitude && carrier.longitude);
                const primaryPhoto = carrier.photos[0] ?? carrier.surfaces.flatMap((s) => s.photos)[0];
                const totalPhotos = new Set([
                  ...carrier.photos.map((p) => p.id),
                  ...carrier.surfaces.flatMap((s) => s.photos.map((p) => p.id)),
                ]).size;
                const isDamaged =
                  carrier.photos.some((p) => p.type === 'DAMAGE') ||
                  carrier.surfaces.some((s) => s.photos.some((p) => p.type === 'DAMAGE')) ||
                  carrier.note?.includes('ZÁVADA');

                const primaryNavSurface = carrier.surfaces.find((s) => s.destinationName || s.directionDescription);

                return (
                  <tr
                    key={carrier.id}
                    className={carrier.archivedAt ? 'bg-slate-50 text-slate-500' : isDamaged ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/60'}
                  >
                    {/* Kód nosiče & Číslo sloupu VO */}
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Link className="font-extrabold text-slate-950 hover:underline font-mono" href={`/carriers/${carrier.id}`}>
                          {carrier.code}
                        </Link>
                        {carrier.structureCode && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 text-sky-950 px-2 py-0.5 text-[11px] font-black border border-sky-300 shadow-2xs">
                            ⚡ Sloup #{carrier.structureCode}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* 📸 Fotografie & Odkaz */}
                    <TableCell>
                      {primaryPhoto ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={primaryPhoto.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs hover:scale-105 transition shrink-0 group"
                            title="Otevřít fotografii v plné velikosti"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={primaryPhoto.id ? `/api/photos/${encodeURIComponent(primaryPhoto.id)}/thumbnail` : primaryPhoto.url}
                              alt={carrier.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                          </a>
                          <div className="flex flex-col text-[11px]">
                            <a
                              href={primaryPhoto.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-sky-700 hover:underline flex items-center gap-1"
                            >
                              <span>Fotka</span>
                              <ExternalLink size={10} />
                            </a>
                            {totalPhotos > 1 && (
                              <span className="text-slate-400 font-medium">({totalPhotos} ks)</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Bez fotky</span>
                      )}
                    </TableCell>

                    {/* Název nosiče */}
                    <TableCell>
                      <b>{carrier.name}</b>
                      <br />
                      <span className="text-slate-500 text-xs">
                        {carrier.carrierTypeRef?.name || carrierTypeLabel(carrier.type)}
                      </span>
                    </TableCell>

                    {/* 🧭 Pozice (GPS souřadnice & Navigace) */}
                    <TableCell>
                      {hasGps ? (
                        <div className="flex flex-col items-start gap-1">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${carrier.latitude},${carrier.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs font-bold text-sky-800 hover:text-sky-950 hover:underline flex items-center gap-1"
                            title="Navigovat v Google Maps"
                          >
                            <MapPin size={13} className="text-rose-500 shrink-0" />
                            <span>{carrier.latitude!.toFixed(5)}, {carrier.longitude!.toFixed(5)}</span>
                          </a>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge value={carrier.gpsStatus === 'VERIFIED' ? 'VERIFIED' : carrier.gpsStatus} />
                            <Link
                              href={`/map?carrier=${carrier.id}`}
                              className="text-[10px] font-bold text-slate-500 hover:text-sky-700 hover:underline"
                            >
                              Mapa
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <StatusBadge value="MISSING" />
                      )}
                    </TableCell>

                    {/* Město & Lokalita */}
                    <TableCell>
                      <div className="text-xs">
                        <strong className="text-slate-900 block">{carrier.city || '-'}</strong>
                        <span className="text-slate-500">
                          {[carrier.locality ?? carrier.cadastralArea, carrier.street ?? carrier.address].filter(Boolean).join(' · ') || '-'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Klient & Navigační cíl */}
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="font-semibold text-slate-900">
                          {clients.join(', ') || <span className="text-slate-400 italic">Bez klienta</span>}
                        </div>
                        {isNavigation && primaryNavSurface && (primaryNavSurface.destinationName || primaryNavSurface.directionDescription) && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                            <span>{getDirectionArrow(primaryNavSurface.directionDescription)}</span>
                            <span className="truncate max-w-[160px]">{primaryNavSurface.destinationName || primaryNavSurface.directionDescription}</span>
                            {primaryNavSurface.distanceMeters && (
                              <span className="text-sky-600">({primaryNavSurface.distanceMeters}m)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Stav nosiče */}
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} />
                        {isDamaged && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white shadow-2xs animate-pulse">
                            🚨 ZÁVADA
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Obsazenost */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {surfaceStatuses.length ? surfaceStatuses.map((status) => <StatusBadge key={status} value={status} />) : <span className="text-slate-400">Bez ploch</span>}
                      </div>
                    </TableCell>

                    {/* Akce */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Link className="table-action font-bold" href={`/carriers/${carrier.id}`}>
                          Detail
                        </Link>
                        {isNavigation && (
                          <Link className="table-action text-sky-700 font-bold bg-sky-50 border border-sky-200" href={`/navigation/carriers/${carrier.id}`}>
                            📜 Audit
                          </Link>
                        )}
                        <Link className="table-action" href={`/map?carrier=${carrier.id}`}>
                          <MapPinned size={13} className="mr-1" />
                          Mapa
                        </Link>
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}
    </AppShell>
  );
}
