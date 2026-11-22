'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { CONTRACT_STATUS_LABELS, ContractRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientContractsTab({ client }: { client: ClientProfileData }) {
  const contracts = client.contracts || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Smlouvy a Právní dokumenty ({contracts.length})</h3>
          <p className="text-xs text-slate-500">Evidence nájemních, servisních a rámcových smluv s hlídáním expirace.</p>
        </div>
      </div>

      {contracts.length === 0 ? (
        <EmptyState title="Žádné smlouvy" description="Pro tohoto klienta zatím nebyla zaevidována žádná smlouva." />
      ) : (
        <Table minWidth="min-w-[800px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Číslo smlouvy / Název</TableHeaderCell>
              <TableHeaderCell>Typ smlouvy</TableHeaderCell>
              <TableHeaderCell>Platnost Od</TableHeaderCell>
              <TableHeaderCell>Platnost Do</TableHeaderCell>
              <TableHeaderCell>Stav</TableHeaderCell>
              <TableHeaderCell>Hodnota</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {contracts.map((c: ContractRecordItem) => {
              const statusObj = CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] || CONTRACT_STATUS_LABELS.ACTIVE;
              const validToDate = c.validTo ? new Date(c.validTo) : null;
              const daysRemaining =
                validToDate && c.status === 'ACTIVE'
                  ? Math.ceil((validToDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                  : null;
              const expiryBadge =
                daysRemaining !== null && daysRemaining <= 30
                  ? daysRemaining < 0
                    ? { text: `Vypršela (${Math.abs(daysRemaining)} d)`, cls: 'bg-red-100 text-red-800 border-red-300' }
                    : daysRemaining <= 7
                    ? { text: `Končí za ${daysRemaining} d`, cls: 'bg-orange-100 text-orange-900 border-orange-300' }
                    : { text: `Končí za ${daysRemaining} d`, cls: 'bg-amber-100 text-amber-900 border-amber-300' }
                  : null;
              return (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">{c.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{c.contractNumber}</div>
                  </TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>{new Date(c.validFrom).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{validToDate ? validToDate.toLocaleDateString('cs-CZ') : 'Neurčito'}</span>
                      {expiryBadge && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${expiryBadge.cls}`}>
                          ⚠️ {expiryBadge.text}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">{c.valueAmount ? `${Number(c.valueAmount).toLocaleString('cs-CZ')} Kč` : '-'}</TableCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
