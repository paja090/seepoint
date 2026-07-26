'use client';

import { Table, TableHead, TableHeaderCell, TableCell, EmptyState } from '@/components/ui';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, CrmTaskRecordItem, ClientProfileData } from '@/lib/crm/types';

export function ClientTasksTab({ client }: { client: ClientProfileData }) {
  const tasks = client.crmTasks || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Úkoly a Připomínky ({tasks.length})</h3>
          <p className="text-xs text-slate-500">Plánování obchodních telefonátů, kontroly schválení podkladů a fakturace.</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="Žádné plánované úkoly" description="Všechny úkoly pro tohoto klienta jsou vyřešené." />
      ) : (
        <Table minWidth="min-w-[800px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Úkol / Připomínka</TableHeaderCell>
              <TableHeaderCell>Typ úkolu</TableHeaderCell>
              <TableHeaderCell>Priorita</TableHeaderCell>
              <TableHeaderCell>Termín splnění</TableHeaderCell>
              <TableHeaderCell>Přiřazený uživatel</TableHeaderCell>
              <TableHeaderCell>Stav</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {tasks.map((task: CrmTaskRecordItem) => {
              const priorityObj = TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] || TASK_PRIORITY_LABELS.NORMAL;
              const statusObj = TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] || TASK_STATUS_LABELS.TODO;
              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'DONE';

              return (
                <tr key={task.id} className="hover:bg-slate-50/70">
                  <TableCell>
                    <div className="font-bold text-slate-900">{task.title}</div>
                  </TableCell>
                  <TableCell>{TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS] || task.type}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityObj.badge}`}>
                      {priorityObj.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                      {new Date(task.dueDate).toLocaleDateString('cs-CZ')}
                      {isOverdue && ' ⚠️ PO TERMÍNU'}
                    </span>
                  </TableCell>
                  <TableCell>{task.assignedUser?.name || '-'}</TableCell>
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
