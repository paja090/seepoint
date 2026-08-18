'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Route, CheckSquare, Square, Zap } from 'lucide-react';
import { Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { OccupancyClientPairing } from '@/components/OccupancyClientPairing';
import { BulkOccupancyBookingModal } from '@/components/BulkOccupancyBookingModal';
import { useOfferBasket } from '@/context/OfferBasketContext';

type SurfaceItem = {
  id: string;
  name: string;
  mediaType: string;
  isDamaged?: boolean;
  carrier: {
    id: string;
    code: string;
    city?: string | null;
    name: string;
  };
};

type OccupancyRow = {
  id: string;
  surfaceId: string;
  clientId?: string | null;
  clientName?: string | null;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  price?: string | number | null;
  surface: SurfaceItem;
  client?: { name: string } | null;
};

type ClientOption = {
  id: string;
  name: string;
};

export function OccupancyTableWithBulk({
  rows,
  clients,
}: {
  rows: OccupancyRow[];
  clients: ClientOption[];
}) {
  const [selectedSurfaceIds, setSelectedSurfaceIds] = useState<string[]>([]);

  const toggleSelect = (surfaceId: string) => {
    if (selectedSurfaceIds.includes(surfaceId)) {
      setSelectedSurfaceIds(selectedSurfaceIds.filter((id) => id !== surfaceId));
    } else {
      setSelectedSurfaceIds([...selectedSurfaceIds, surfaceId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSurfaceIds.length === rows.length) {
      setSelectedSurfaceIds([]);
    } else {
      setSelectedSurfaceIds(rows.map((r) => r.surface.id));
    }
  };

  const { toggleSurface, isSurfaceSelected } = useOfferBasket();

  const selectedSurfacesInfo = rows
    .filter((r) => selectedSurfaceIds.includes(r.surface.id))
    .map((r) => ({
      id: r.surface.id,
      name: r.surface.name,
      carrierCode: r.surface.carrier.code,
      carrierCity: r.surface.carrier.city || '',
      carrierName: r.surface.carrier.name,
      price: r.price,
      mediaType: r.surface.mediaType,
      carrierId: r.surface.carrier.id,
    }));

  return (
    <>
      <BulkOccupancyBookingModal
        selectedSurfaces={selectedSurfacesInfo}
        clients={clients}
        onClearSelection={() => setSelectedSurfaceIds([])}
      />

      <Table minWidth="min-w-[1020px]">
        <TableHead>
          <tr>
            <TableHeaderCell>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900"
                title="Označit vše (Excel vyber)"
              >
                {selectedSurfaceIds.length > 0 && selectedSurfaceIds.length === rows.length ? (
                  <CheckSquare size={16} className="text-emerald-600" />
                ) : (
                  <Square size={16} className="text-slate-400" />
                )}
                <span>Vybrat</span>
              </button>
            </TableHeaderCell>
            <TableHeaderCell>Nosič</TableHeaderCell>
            <TableHeaderCell>Plocha</TableHeaderCell>
            <TableHeaderCell>Klient</TableHeaderCell>
            <TableHeaderCell>Kampaň</TableHeaderCell>
            <TableHeaderCell>Od</TableHeaderCell>
            <TableHeaderCell>Do</TableHeaderCell>
            <TableHeaderCell>Stav</TableHeaderCell>
            <TableHeaderCell>Akce & Montáž</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedSurfaceIds.includes(row.surface.id);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateToObj = new Date(row.dateTo);
            dateToObj.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dateToObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const isEndingSoon = diffDays >= 0 && diffDays <= 7 && ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(row.status);
            const freeFromDate = new Date(dateToObj.getTime() + 86400000).toISOString().slice(0, 10);

            return (
              <tr
                className={`transition ${isSelected ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50/60'}`}
                key={row.id}
              >
                <TableCell>
                  <button
                    onClick={() => toggleSelect(row.surface.id)}
                    className="p-1 text-slate-500 hover:text-emerald-600"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-emerald-600" />
                    ) : (
                      <Square size={18} className="text-slate-300" />
                    )}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link className="font-semibold text-slate-950 hover:underline font-mono" href={`/carriers/${row.surface.carrier.id}`}>
                      {row.surface.carrier.code}
                    </Link>
                    {row.surface.isDamaged && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white shadow-2xs animate-pulse">
                        🚨 ZÁVADA
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500">{row.surface.carrier.city}</span>
                </TableCell>
                <TableCell>
                  {row.surface.name}
                  <br />
                  <span className="text-slate-500">{mediaTypeLabel(row.surface.mediaType as any)}</span>
                </TableCell>
                <TableCell>
                  <OccupancyClientPairing
                    occupancyId={row.id}
                    surfaceId={row.surfaceId}
                    initialClientId={row.clientId ?? null}
                    initialClientName={row.clientName ?? null}
                    matchedClientName={row.client?.name}
                    clients={clients}
                  />
                </TableCell>
                <TableCell>
                  <b>{row.campaignName}</b>
                  {row.price && <span className="block text-xs font-bold text-emerald-700">{Number(row.price).toLocaleString('cs-CZ')} Kč</span>}
                  {isEndingSoon && (
                    <span className="mt-1 block rounded-lg bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900">
                      ⏳ Končí za {diffDays === 0 ? 'dnes' : `${diffDays} dní`} (Volná od {freeFromDate})
                    </span>
                  )}
                </TableCell>
                <TableCell>{new Date(row.dateFrom).toISOString().slice(0, 10)}</TableCell>
                <TableCell>{new Date(row.dateTo).toISOString().slice(0, 10)}</TableCell>
                <TableCell><StatusBadge value={row.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSurface({
                          id: row.surface.id,
                          name: row.surface.name,
                          carrierId: row.surface.carrier.id,
                          carrierCode: row.surface.carrier.code,
                          carrierName: row.surface.carrier.name,
                          city: row.surface.carrier.city || '',
                          price: typeof row.price === 'number' ? row.price : row.price ? parseFloat(String(row.price)) : undefined,
                          mediaType: row.surface.mediaType,
                        })
                      }
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition shadow-2xs ${
                        isSurfaceSelected(row.surface.id)
                          ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          : 'border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                      }`}
                      title="Přidat nebo odebrat tuto plochu z košíku nabídek"
                    >
                      {isSurfaceSelected(row.surface.id) ? '✓ V nabídce' : '📋 + Nabídka'}
                    </button>
                    <Link className="table-action" href={`/carriers/${row.surface.carrier.id}`}>
                      Detail
                    </Link>
                    {['OCCUPIED', 'RESERVED'].includes(row.status) && (
                      <Link
                        className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-slate-950 shadow-sm border border-emerald-400 hover:bg-emerald-400 active:scale-95 transition"
                        href={`/work?carrierCode=${row.surface.carrier.code}&clientName=${encodeURIComponent(row.clientName || '')}&campaignDateFrom=${new Date(row.dateFrom).toISOString().slice(0, 10)}&campaignDateTo=${new Date(row.dateTo).toISOString().slice(0, 10)}`}
                        title="Vytvořit pracovní úkol / montáž v Plánu práce s předvyplněnými údaji"
                      >
                        <Route size={13} />
                        <span>Montáž</span>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
