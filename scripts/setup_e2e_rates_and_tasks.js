import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Get first work order
  const order = await prisma.workOrder.findFirst();
  if (!order) {
    throw new Error('No WorkOrder found in database to link the task to.');
  }
  console.log(`Using WorkOrder: ID=${order.id}, Title=${order.title}`);

  // 2. Get the worker employee
  const worker = await prisma.employee.findFirst({
    where: { email: 'worker@seepoint.cz' }
  });
  if (!worker) {
    throw new Error('Worker employee not found in database.');
  }

  // 3. Upsert WorkTask
  const task = await prisma.workTask.upsert({
    where: { id: 'task-e2e-1' },
    update: {
      title: 'E2E Testovací úkol',
      workOrderId: order.id,
      remunerationMethod: 'HOURLY',
      status: 'TODO'
    },
    create: {
      id: 'task-e2e-1',
      title: 'E2E Testovací úkol',
      workOrderId: order.id,
      remunerationMethod: 'HOURLY',
      status: 'TODO'
    }
  });
  console.log(`WorkTask: ID=${task.id}, Title=${task.title}`);

  // 4. Upsert EmployeeRate
  const rate = await prisma.employeeRate.upsert({
    where: { id: 'rate-e2e-1' },
    update: {
      employeeId: worker.id,
      type: 'HOURLY',
      name: 'E2E Hodinová sazba',
      amount: 400.00,
      unit: 'hod',
      workType: 'INSTALLATION',
      validFrom: new Date('2026-01-01'),
      isActive: true
    },
    create: {
      id: 'rate-e2e-1',
      employeeId: worker.id,
      type: 'HOURLY',
      name: 'E2E Hodinová sazba',
      amount: 400.00,
      unit: 'hod',
      workType: 'INSTALLATION',
      validFrom: new Date('2026-01-01'),
      isActive: true
    }
  });
  console.log(`EmployeeRate: ID=${rate.id}, Amount=${rate.amount}, WorkType=${rate.workType}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
