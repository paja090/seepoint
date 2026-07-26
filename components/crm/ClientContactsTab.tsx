'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { PREFERRED_COMM_LABELS, ClientContactItem, ClientProfileData } from '@/lib/crm/types';

export function ClientContactsTab({ client }: { client: ClientProfileData }) {
  const contacts = client.contacts || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Kontaktní osoby ({contacts.length})</h3>
          <p className="text-xs text-slate-500">Evidence všech kontaktních osob klienta s vyznačením kompetencí.</p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState title="Žádné kontaktní osoby" description="Přidejte první kontaktní osobu tlačítkem v hlavičce profilu." />
      ) : (
        <Table minWidth="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Jméno a Příjmení</TableHeaderCell>
              <TableHeaderCell>Pozice / Oddělení</TableHeaderCell>
              <TableHeaderCell>E-mail</TableHeaderCell>
              <TableHeaderCell>Telefon</TableHeaderCell>
              <TableHeaderCell>Kompetence</TableHeaderCell>
              <TableHeaderCell>Preferovaná komunikace</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {contacts.map((contact: ClientContactItem) => (
              <tr key={contact.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <div className="font-bold text-slate-900">
                    {contact.firstName} {contact.lastName}
                    {contact.isPrimary && (
                      <span className="ml-2 bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                        HLAVNÍ KONTAKT
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{contact.title || contact.department || '-'}</TableCell>
                <TableCell>{contact.email ? <a href={`mailto:${contact.email}`} className="text-sky-600 hover:underline">{contact.email}</a> : '-'}</TableCell>
                <TableCell>{contact.phone ? <a href={`tel:${contact.phone}`} className="text-sky-600 hover:underline">{contact.phone}</a> : '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap text-[10px]">
                    {contact.isCommercial && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Obchod</span>}
                    {contact.isRealization && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Realizace</span>}
                    {contact.isBilling && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Fakturace</span>}
                  </div>
                </TableCell>
                <TableCell>{PREFERRED_COMM_LABELS[contact.preferredCommunication as keyof typeof PREFERRED_COMM_LABELS] || contact.preferredCommunication}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
