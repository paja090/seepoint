'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { ORDER_STATUS_LABELS, PROJECT_TYPE_LABELS, CrmOrderRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientOrdersTab({ client }: { client: ClientProfileData }) {
  const orders = client.crmOrders || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Zakázky a Kampaně ({orders.length})</h3>
          <p className="text-xs text-slate-500">Centrální obchodní evidování zakázek a navázaných realizačních celků.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="Žádné zakázky" description="Klient zatím nemá založenou žádnou zakázku." />
      ) : (
        <Table minWidth="min-w-[850px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Číslo zakázky / Název</TableHeaderCell>
              <TableHeaderCell>Typ projektu</TableHeaderCell>
              <TableHeaderCell>Stav</TableHeaderCell>
              <TableHeaderCell>Cena zakázky</TableHeaderCell>
              <TableHeaderCell>Obchodník</TableHeaderCell>
              <TableHeaderCell>Realizační úkoly</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {orders.map((order: CrmOrderRecordItem) => {
              const statusObj = ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
              return (
                <tr key={order.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">{order.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{order.orderNumber}</div>
                  </TableCell>
                  <TableCell>{PROJECT_TYPE_LABELS[order.projectType as keyof typeof PROJECT_TYPE_LABELS] || order.projectType}</TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">{order.totalPrice ? `${Number(order.totalPrice).toLocaleString('cs-CZ')} Kč` : '-'}</TableCell>
                  <TableCell>{order.assignedUser?.name || '-'}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {order._count?.workOrders || 0} příkazů
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
