'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { REALIZATION_STATUS_LABELS, CrmRealizationRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientRealizationsTab({ client }: { client: ClientProfileData }) {
  // Collect all realizations across orders
  const realizations = (client.crmOrders || []).flatMap((o) => o.realizations || []);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Realizace a Fotodokumentace ({realizations.length})</h3>
          <p className="text-xs text-slate-500">Sledování stavu instalace, polepů a výroby pro jednotlivé reklamní plochy.</p>
        </div>
      </div>

      {realizations.length === 0 ? (
        <EmptyState title="Žádné realizace" description="Zatím nebyla evidována žádná realizace." />
      ) : (
        <Table minWidth="min-w-[800px]">
          <TableHead>
            <tr>
              <TableHeaderCell>ID / Pozice</TableHeaderCell>
              <TableHeaderCell>Stav realizace</TableHeaderCell>
              <TableHeaderCell>Plánovaný termín</TableHeaderCell>
              <TableHeaderCell>Skutečný termín</TableHeaderCell>
              <TableHeaderCell>Odpovědný technik</TableHeaderCell>
              <TableHeaderCell>Poznámka / Reklamace</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {realizations.map((r: CrmRealizationRecordItem) => {
              const statusObj = REALIZATION_STATUS_LABELS[r.status as keyof typeof REALIZATION_STATUS_LABELS] || REALIZATION_STATUS_LABELS.WAITING_FOR_MATERIALS;
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">{r.id}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </TableCell>
                  <TableCell>{r.plannedDate ? new Date(r.plannedDate).toLocaleDateString('cs-CZ') : '-'}</TableCell>
                  <TableCell>{r.actualDate ? new Date(r.actualDate).toLocaleDateString('cs-CZ') : '-'}</TableCell>
                  <TableCell>{r.assignedUser?.name || '-'}</TableCell>
                  <TableCell>{r.note || r.claimNote || '-'}</TableCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
