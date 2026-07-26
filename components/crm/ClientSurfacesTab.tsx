'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { OccupancyRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientSurfacesTab({ client }: { client: ClientProfileData }) {
  const occupancies = client.occupancies || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Obsazenost a Pronajaté Plochy ({occupancies.length})</h3>
          <p className="text-xs text-slate-500">Přehled pronajatých nosičů (navigace, lavičky, CLV, towery, city postery).</p>
        </div>
      </div>

      {occupancies.length === 0 ? (
        <EmptyState title="Žádné aktivní pronájmy" description="Klient aktuálně nemá pronajaté žádné reklamní nosiče ani navigace." />
      ) : (
        <Table minWidth="min-w-[800px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Nosič / Cílové Místo</TableHeaderCell>
              <TableHeaderCell>Typ média</TableHeaderCell>
              <TableHeaderCell>Rezervace Od</TableHeaderCell>
              <TableHeaderCell>Rezervace Do</TableHeaderCell>
              <TableHeaderCell>Stav pronájmu</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {occupancies.map((occ: OccupancyRecordItem) => {
              const dateTo = new Date(occ.dateTo);
              const isExpired = dateTo < new Date();

              return (
                <tr key={occ.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">
                      {occ.surface?.carrier?.name || occ.surface?.name || 'Reklamní nosič'}
                    </div>
                    {occ.surface?.carrier?.city && <div className="text-xs text-slate-500">📍 {occ.surface.carrier.city}</div>}
                  </TableCell>
                  <TableCell><span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded border">{occ.surface?.mediaType || 'Nosič'}</span></TableCell>
                  <TableCell>{new Date(occ.dateFrom).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>{dateTo.toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>
                    {isExpired ? (
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                        Ukončeno
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Aktivně obsazeno
                      </span>
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
