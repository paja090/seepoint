'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { DocumentRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientDocumentsTab({ client }: { client: ClientProfileData }) {
  const documents = client.documents || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Dokumenty & Soubory ({documents.length})</h3>
          <p className="text-xs text-slate-500">Smlouvy, předávací protokoly, tiskové podklady a přílohy uložené na Google Drive.</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState title="Žádné dokumenty" description="Pro tohoto klienta zatím nebyly nahrány žádné dokumenty." />
      ) : (
        <Table minWidth="min-w-[700px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Název dokumentu</TableHeaderCell>
              <TableHeaderCell>Typ</TableHeaderCell>
              <TableHeaderCell>Datum nahrání</TableHeaderCell>
              <TableHeaderCell>Nahrál</TableHeaderCell>
              <TableHeaderCell>Akce</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {documents.map((doc: DocumentRecordItem) => (
              <tr key={doc.id} className="hover:bg-slate-50/70">
                <TableCell>
                  <div className="font-bold text-slate-900">{doc.name}</div>
                  {doc.fileName && <div className="text-xs text-slate-500">{doc.fileName}</div>}
                </TableCell>
                <TableCell><span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded border">{doc.type}</span></TableCell>
                <TableCell>{new Date(doc.createdAt).toLocaleDateString('cs-CZ')}</TableCell>
                <TableCell>{doc.uploaderUser?.name || '-'}</TableCell>
                <TableCell>
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="table-action">Otevřít ↗</a>
                  ) : '-'}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
