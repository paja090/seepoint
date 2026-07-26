'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { ClientBranchItem, ClientProfileData } from '@/lib/crm/types';

export function ClientBranchesTab({ client }: { client: ClientProfileData }) {
  const branches = client.branches || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Pobočky a Provozovny ({branches.length})</h3>
          <p className="text-xs text-slate-500">Adresy a cílové prodejny klienta pro projekt Navigace a lokální reklamu.</p>
        </div>
      </div>

      {branches.length === 0 ? (
        <EmptyState title="Žádné pobočky" description="Klient zatím nemá evidované žádné pobočky." />
      ) : (
        <Table minWidth="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Kód / Název pobočky</TableHeaderCell>
              <TableHeaderCell>Adresa</TableHeaderCell>
              <TableHeaderCell>Město / PSČ</TableHeaderCell>
              <TableHeaderCell>GPS souřadnice</TableHeaderCell>
              <TableHeaderCell>Kontaktní osoba</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {branches.map((b: ClientBranchItem) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <div className="font-bold text-slate-900">{b.name}</div>
                  {b.code && <span className="text-xs text-slate-500 font-mono">{b.code}</span>}
                </TableCell>
                <TableCell>{b.street || '-'}</TableCell>
                <TableCell>{b.city ? `${b.city} ${b.zip || ''}` : '-'}</TableCell>
                <TableCell>
                  {b.latitude && b.longitude ? (
                    <a href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">
                      📍 {b.latitude.toFixed(5)}, {b.longitude.toFixed(5)}
                    </a>
                  ) : '-'}
                </TableCell>
                <TableCell>{b.contactPerson ? `${b.contactPerson.firstName} ${b.contactPerson.lastName}` : '-'}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
