'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { CrmAuditLogItem, ClientProfileData } from '@/lib/crm/types';

export function ClientAuditTab({ client }: { client: ClientProfileData }) {
  const [logs, setLogs] = useState<CrmAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${client.id}/audit`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Auditní Log Změn</h3>
          <p className="text-xs text-slate-500">Bezpečnostní záznamy o všech úpravách, vytvoření kontaktů a zpráv v CRM profilu klienta.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 italic py-4">Načítám bezpečnostní logy...</p>
      ) : logs.length === 0 ? (
        <EmptyState title="Žádné auditní logy" description="Pro tohoto klienta nebyly nalezeny žádné historické změny." />
      ) : (
        <Table minWidth="min-w-[750px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Čas události</TableHeaderCell>
              <TableHeaderCell>Uživatel</TableHeaderCell>
              <TableHeaderCell>Akce</TableHeaderCell>
              <TableHeaderCell>Entita</TableHeaderCell>
              <TableHeaderCell>Detailní změny</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {logs.map((log: CrmAuditLogItem) => (
              <tr key={log.id} className="hover:bg-slate-50/70">
                <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString('cs-CZ')}</TableCell>
                <TableCell>
                  <div className="font-bold text-slate-900 text-xs">{log.userEmail}</div>
                </TableCell>
                <TableCell>
                  <span className="bg-slate-100 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-300">
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-xs font-semibold">{log.entityType}</TableCell>
                <TableCell className="text-xs text-slate-600 font-mono max-w-xs truncate">
                  {log.detailsJson || '-'}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
