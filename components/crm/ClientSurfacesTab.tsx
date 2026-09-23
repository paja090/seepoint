'use client';

import { useState } from 'react';
import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { ClientProfileData, OccupiedSurfaceItem } from '@/lib/crm/types';
import { MapPin, Navigation, ExternalLink, Globe, CheckCircle2, Clock } from 'lucide-react';

export function ClientSurfacesTab({ client }: { client: ClientProfileData }) {
  const [filter, setFilter] = useState<'ALL' | 'NAVIGATION' | 'STANDARD'>('ALL');

  // Unified surfaces provided by client-service
  const surfaces: OccupiedSurfaceItem[] = client.occupiedSurfaces && client.occupiedSurfaces.length > 0
    ? client.occupiedSurfaces
    : (client.occupancies || []).map((occ) => {
        const dateTo = new Date(occ.dateTo);
        const isExpired = dateTo < new Date();
        return {
          id: `occ-${occ.id}`,
          sourceType: 'OCCUPANCY' as const,
          title: occ.surface?.carrier?.name || occ.surface?.name || 'Reklamní nosič',
          carrierCode: null,
          mediaType: occ.surface?.mediaType || 'Standardní nosič',
          variantOrSize: null,
          city: occ.surface?.carrier?.city || null,
          address: occ.surface?.carrier?.name || null,
          dateFrom: occ.dateFrom,
          dateTo: occ.dateTo,
          status: isExpired ? ('EXPIRED' as const) : ('ACTIVE' as const),
          campaignOrOrderName: null,
          portalToken: client.portalToken || null,
        };
      });

  const filteredSurfaces = surfaces.filter((s) => {
    if (filter === 'NAVIGATION') return s.sourceType === 'NAVIGATION';
    if (filter === 'STANDARD') return s.sourceType !== 'NAVIGATION';
    return true;
  });

  const activeCount = surfaces.filter((s) => s.status === 'ACTIVE').length;
  const navCount = surfaces.filter((s) => s.sourceType === 'NAVIGATION').length;
  const standardCount = surfaces.filter((s) => s.sourceType !== 'NAVIGATION').length;

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <span>Obsazenost a Pronajaté Plochy ({surfaces.length})</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {activeCount} aktivních
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">
            Kompletní přehled pronajatých reklamních ploch a navigačních panelů na sloupech VO.
          </p>
        </div>

        {/* Filter Tabs */}
        {surfaces.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'ALL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vše ({surfaces.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('NAVIGATION')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                filter === 'NAVIGATION' ? 'bg-white shadow-xs text-sky-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation size={12} className="text-sky-600" />
              <span>Navigace VO ({navCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('STANDARD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                filter === 'STANDARD' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ostatní plochy ({standardCount})
            </button>
          </div>
        )}
      </div>

      {filteredSurfaces.length === 0 ? (
        <EmptyState
          title="Žádné evidované plochy"
          description={
            filter === 'NAVIGATION'
              ? 'Klient nemá aktivní navigační panely na sloupech VO.'
              : filter === 'STANDARD'
              ? 'Klient nemá aktivní pronájmy standardních billboardů ani CLV.'
              : 'Klient aktuálně nemá pronajaté žádné reklamní nosiče ani navigační panely.'
          }
        />
      ) : (
        <Table minWidth="min-w-[900px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Nosič / Sloup VO & Lokalita</TableHeaderCell>
              <TableHeaderCell>Typ média & Rozměr</TableHeaderCell>
              <TableHeaderCell>Kampaň / Zakázka</TableHeaderCell>
              <TableHeaderCell>Termín / Platnost</TableHeaderCell>
              <TableHeaderCell>Stav</TableHeaderCell>
              <TableHeaderCell className="text-right">Portál</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {filteredSurfaces.map((surf) => {
              const dateFromStr = surf.dateFrom ? new Date(surf.dateFrom).toLocaleDateString('cs-CZ') : null;
              const dateToStr = surf.dateTo ? new Date(surf.dateTo).toLocaleDateString('cs-CZ') : null;

              return (
                <tr key={surf.id} className="hover:bg-slate-50/70 transition">
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {surf.sourceType === 'NAVIGATION' ? (
                        <div className="p-1 rounded-md bg-sky-100 text-sky-700 mt-0.5 shrink-0">
                          <Navigation size={13} />
                        </div>
                      ) : (
                        <div className="p-1 rounded-md bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                          <MapPin size={13} />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{surf.title}</span>
                          {surf.pillarNumber && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200">
                              Sloup {surf.pillarNumber}
                            </span>
                          )}
                        </div>
                        {(surf.address || surf.city) && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {surf.address ? surf.address : ''}
                            {surf.city ? ` · ${surf.city}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${
                        surf.sourceType === 'NAVIGATION'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {surf.mediaType}
                      </span>
                      {surf.variantOrSize && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          {surf.variantOrSize}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {surf.campaignOrOrderName ? (
                      <span className="text-xs font-medium text-slate-800">{surf.campaignOrOrderName}</span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {dateFromStr && dateToStr ? (
                        <span>{dateFromStr} – {dateToStr}</span>
                      ) : dateFromStr ? (
                        <span>Od {dateFromStr}</span>
                      ) : (
                        <span className="text-slate-400">Dlouhodobě</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {surf.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Aktivně obsazeno
                      </span>
                    ) : surf.status === 'PLANNED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                        <Clock size={12} className="text-sky-600" />
                        V přípravě / montáž
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                        Ukončeno
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {surf.portalToken ? (
                      <a
                        href={`/offer/${surf.portalToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs border border-sky-200 transition"
                        title="Zobrazit na živém klientském portálu"
                      >
                        <Globe size={12} />
                        <span>Portál</span>
                        <ExternalLink size={10} />
                      </a>
                    ) : client.portalToken ? (
                      <a
                        href={`/offer/${client.portalToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 transition"
                      >
                        <Globe size={12} />
                        <span>Portál</span>
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
