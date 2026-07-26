'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { CLIENT_INVOICE_STATUS_LABELS, ClientInvoiceRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientInvoicesTab({ client }: { client: ClientProfileData }) {
  const invoices = client.invoices || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Vydané Faktury & Úhrady ({invoices.length})</h3>
          <p className="text-xs text-slate-500">Přehled vystavených faktur, splatností a platební morálky klienta.</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="Žádné faktury" description="Klientovi zatím nebyly vystaveny žádné faktury." />
      ) : (
        <Table minWidth="min-w-[850px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Číslo faktury / VS</TableHeaderCell>
              <TableHeaderCell>Typ</TableHeaderCell>
              <TableHeaderCell>Datum vystavení</TableHeaderCell>
              <TableHeaderCell>Splatnost</TableHeaderCell>
              <TableHeaderCell>Částka s DPH</TableHeaderCell>
              <TableHeaderCell>Stav úhrady</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {invoices.map((inv: ClientInvoiceRecordItem) => {
              const statusObj = CLIENT_INVOICE_STATUS_LABELS[inv.status as keyof typeof CLIENT_INVOICE_STATUS_LABELS] || CLIENT_INVOICE_STATUS_LABELS.ISSUED;
              return (
                <tr key={inv.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">{inv.invoiceNumber}</div>
                    {inv.variableSymbol && <div className="text-xs text-slate-500 font-mono">VS: {inv.variableSymbol}</div>}
                  </TableCell>
                  <TableCell>{inv.type}</TableCell>
                  <TableCell>{new Date(inv.issueDate).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell className="font-bold">{Number(inv.totalAmount).toLocaleString('cs-CZ')} Kč</TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
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
