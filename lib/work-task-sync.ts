import type { Employee, Prisma, WorkOrderStatus, WorkPriority } from '@prisma/client';
import { prisma } from '@/lib/db';

type WorkOrderForSync = Prisma.WorkOrderGetPayload<{
  include: {
    assignments: true;
    items: { include: { carrier: true } };
  };
}>;

type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('cs-CZ').replace(/\s+/g, ' ');
}

function workTaskStatus(status: WorkOrderStatus) {
  if (status === 'DONE') return 'DONE' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'IN_PROGRESS' || status === 'HANDED_OVER') return 'IN_PROGRESS' as const;
  return 'TODO' as const;
}

function workTaskPriority(priority: WorkPriority): TaskPriority {
  return priority as TaskPriority;
}

async function employeeByNames(workerNames: string[], client: Prisma.TransactionClient | typeof prisma = prisma) {
  const employees = await client.employee.findMany({ where: { isActive: true } });
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

function taskLocation(order: WorkOrderForSync) {
  const carrier = order.items[0]?.carrier;
  return [order.locationNote, carrier ? `${carrier.code} ${carrier.city}` : undefined].filter(Boolean).join(' · ') || null;
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

export async function syncWorkOrderTasks(workOrderId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const order = await client.workOrder.findUnique({
    where: { id: workOrderId },
    include: { assignments: true, items: { include: { carrier: true } } },
  });
  if (!order) return;

  const workerNames = [...new Set(order.assignments.map((assignment) => assignment.workerName.trim()).filter(Boolean))];
  const namesForTasks = workerNames.length ? workerNames : [''];
  const employees = await employeeByNames(workerNames, client);
  const carrierId = order.items[0]?.carrierId ?? null;
  const status = workTaskStatus(order.status);
  const priority = workTaskPriority(order.priority);
  const location = taskLocation(order);

  const syncLogic = async (transaction: Prisma.TransactionClient) => {
    const existingTasks = await transaction.workTask.findMany({
      where: { workOrderId: order.id },
      include: { workEntries: true },
    });

    const matchedIds = new Set<string>();

    for (const workerName of namesForTasks) {
      const employee = workerName ? employees.get(workerName) : undefined;
      const employeeId = employee?.id ?? null;
      const expectedTitle = taskTitle(order, workerName || undefined);

      const matchedTask = existingTasks.find(t => 
        (employeeId !== null && t.assignedToEmployeeId === employeeId) ||
        (employeeId === null && t.assignedToEmployeeId === null && t.title === expectedTitle)
      );

      const taskData = {
        title: expectedTitle,
        description: order.description,
        assignedToEmployeeId: employeeId,
        carrierId,
        dueDate: order.deadlineAt,
        scheduledDate: order.scheduledAt,
        priority,
        status,
        location,
        note: taskNote(order, workerName || undefined, employee),
      };

      if (matchedTask) {
        matchedIds.add(matchedTask.id);
        await transaction.workTask.update({
          where: { id: matchedTask.id },
          data: taskData,
        });
      } else {
        await transaction.workTask.create({
          data: {
            workOrderId: order.id,
            ...taskData,
          },
        });
      }
    }

    const unmatchedTasks = existingTasks.filter(t => !matchedIds.has(t.id));
    for (const task of unmatchedTasks) {
      if (task.workEntries.length > 0) {
        throw new Error(`NELZE_ODEBRAT_PRACOVNIKA: Pracovník přiřazený k úkolu "${task.title}" již vykázal práci. Odebrání pracovníka bylo zablokováno.`);
      } else {
        await transaction.workTask.delete({ where: { id: task.id } });
      }
    }
  };

  if (tx) {
    await syncLogic(tx);
  } else {
    await prisma.$transaction(syncLogic);
  }
}
