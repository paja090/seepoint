import type { Employee, Prisma, WorkOrderStatus, WorkPriority } from '@prisma/client';
import { prisma } from '@/lib/db';

type WorkOrderForSync = Prisma.WorkOrderGetPayload<{
  include: {
    assignments: true;
    items: { include: { carrier: true } };
  };
}>;

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('cs-CZ').replace(/\s+/g, ' ');
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? value.trim(),
    lastName: parts.slice(1).join(' ') || parts[0] || value.trim(),
  };
}

function workTaskStatus(status: WorkOrderStatus) {
  if (status === 'DONE') return 'DONE' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'IN_PROGRESS' || status === 'HANDED_OVER') return 'IN_PROGRESS' as const;
  return 'TODO' as const;
}

function workTaskPriority(priority: WorkPriority) {
  return priority;
}

async function employeeByNames(workerNames: string[]) {
  const employees = await prisma.employee.findMany({ where: { isActive: true } });
  const byName = new Map<string, Employee>();
  for (const employee of employees) {
    byName.set(normalizeName(`${employee.firstName} ${employee.lastName}`), employee);
    if (employee.email) byName.set(normalizeName(employee.email), employee);
  }
  return new Map(workerNames.map((workerName) => [workerName, byName.get(normalizeName(workerName))]));
}

function taskTitle(order: WorkOrderForSync, workerName?: string) {
  return workerName ? `${order.title} · ${workerName}` : order.title;
}

function taskNote(order: WorkOrderForSync, workerName?: string, employee?: Employee) {
  const lines = [
    `Zdroj: plán práce /work/${order.id}`,
    `Klient: ${order.clientName}`,
    order.requestedBy ? `Zadavatel: ${order.requestedBy}` : undefined,
    workerName && !employee ? `Pracovník zatím není spárovaný se zaměstnancem: ${workerName}` : undefined,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function syncWorkOrderTasks(workOrderId: string) {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { assignments: true, items: { include: { carrier: true } } },
  });
  if (!order) return;

  const workerNames = [...new Set(order.assignments.map((assignment) => assignment.workerName.trim()).filter(Boolean))];
  const namesForTasks = workerNames.length ? workerNames : [''];
  const employees = await employeeByNames(workerNames);
  const carrierId = order.items[0]?.carrierId ?? null;
  const carrier = order.items[0]?.carrier;
  const status = workTaskStatus(order.status);
  const priority = workTaskPriority(order.priority);

  await prisma.$transaction(async (transaction) => {
    await transaction.workTask.deleteMany({ where: { workOrderId: order.id } });
    await transaction.workTask.createMany({
      data: namesForTasks.map((workerName) => {
        const employee = workerName ? employees.get(workerName) : undefined;
        const fallbackName = workerName || 'Nepřiřazeno';
        const split = splitName(fallbackName);
        return {
          workOrderId: order.id,
          title: taskTitle(order, workerName || undefined),
          description: order.description,
          assignedToEmployeeId: employee?.id ?? null,
          carrierId,
          dueDate: order.deadlineAt,
          scheduledDate: order.scheduledAt,
          priority,
          status,
          location: order.locationNote ?? carrier ? [order.locationNote, carrier ? `${carrier.code} ${carrier.city}` : undefined].filter(Boolean).join(' · ') : null,
          note: taskNote(order, workerName || undefined, employee),
        };
      }),
    });
  });
}
