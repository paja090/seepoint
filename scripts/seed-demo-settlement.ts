import { PrismaClient, WorkType } from '@prisma/client';
import { hashPassword } from '../lib/auth-crypto.ts';

const prisma = new PrismaClient();

async function main() {
  // 1. Verify NODE_ENV is not production
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Tento skript nelze spustit v produkčním prostředí!');
    process.exit(1);
  }

  const demoEmail = 'demo.worker@seepoint.local';
  console.log(`Zahajuji přípravu E2E demo dat pro uživatele: ${demoEmail}`);

  // 2. Safely clean up existing demo records for Jan Novák to ensure idempotency
  const existingEmployee = await prisma.employee.findFirst({
    where: { email: demoEmail }
  });

  if (existingEmployee) {
    console.log(`Nalezen existující demo pracovník ID: ${existingEmployee.id}. Provedeme bezpečné odstranění starých demo dat.`);
    
    // Delete audit logs
    await prisma.settlementAuditLog.deleteMany({
      where: { settlement: { employeeId: existingEmployee.id } }
    });

    // Delete adjustments
    await prisma.settlementAdjustment.deleteMany({
      where: { settlement: { employeeId: existingEmployee.id } }
    });

    // Delete items
    await prisma.settlementItem.deleteMany({
      where: { settlement: { employeeId: existingEmployee.id } }
    });

    // Delete settlements
    await prisma.settlement.deleteMany({
      where: { employeeId: existingEmployee.id }
    });

    // Delete work expenses
    await prisma.workExpense.deleteMany({
      where: { workEntry: { employeeId: existingEmployee.id } }
    });

    // Delete work entries
    await prisma.workEntry.deleteMany({
      where: { employeeId: existingEmployee.id }
    });

    // Delete employee rates
    await prisma.employeeRate.deleteMany({
      where: { employeeId: existingEmployee.id }
    });

    // Delete employee
    await prisma.employee.delete({
      where: { id: existingEmployee.id }
    });
    
    console.log('Stará demo data pracovníka byla úspěšně odstraněna.');
  }

  // Clean up user account
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail }
  });
  if (existingUser) {
    await prisma.userSession.deleteMany({ where: { userId: existingUser.id } });
    await prisma.userToken.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
    console.log('Starý demo uživatelský účet byl úspěšně odstraněn.');
  }

  // Clean up demo clients, orders and tasks
  await prisma.workTask.deleteMany({
    where: { id: { in: ['task-demo-1', 'task-demo-2', 'task-demo-3', 'task-demo-4', 'task-demo-5'] } }
  });
  await prisma.workOrder.deleteMany({
    where: { id: { in: ['order-demo-1', 'order-demo-2', 'order-demo-3', 'order-demo-4', 'order-demo-5'] } }
  });
  await prisma.client.deleteMany({
    where: { id: 'client-demo-reklama' }
  });
  console.log('Staré demo zakázky a úkoly byly odstraněny.');

  if (process.argv.includes('--clean')) {
    console.log('Demo data byla úspěšně kompletně odstraněna. Končím.');
    return;
  }

  // 3. Create demo User
  const pw = 'Password12345';
  const hashedPw = await hashPassword(pw);

  const demoUser = await prisma.user.create({
    data: {
      id: 'user-demo-novak',
      email: demoEmail,
      name: 'Jan Novák',
      role: 'WORKER',
      status: 'ACTIVE',
      passwordHash: hashedPw
    }
  });
  console.log(`Demo uživatelský účet vytvořen: ID=${demoUser.id}, Email=${demoUser.email}`);

  // 4. Create demo Employee
  const demoEmp = await prisma.employee.create({
    data: {
      id: 'employee-demo-novak',
      email: demoEmail,
      firstName: 'Jan',
      lastName: 'Novák',
      role: 'WORKER',
      userId: demoUser.id,
      isActive: true,
      note: 'DEMO'
    }
  });
  console.log(`Demo pracovník vytvořen: ID=${demoEmp.id}`);

  // 5. Create demo Client
  const demoClient = await prisma.client.create({
    data: {
      id: 'client-demo-reklama',
      name: 'DEMO Klient - Reklama s.r.o.',
      normalizedName: 'demo klient - reklama s.r.o.',
      active: true,
      note: 'DEMO'
    }
  });

  // 6. Create demo Work Orders and Tasks
  const ordersData = [
    { id: 'order-demo-1', title: 'Výměna kampaně Ostrava centrum', type: 'INSTALLATION' },
    { id: 'order-demo-2', title: 'Instalace CITY posterů – Futurum', type: 'REINSTALLATION' },
    { id: 'order-demo-3', title: 'Kontrola laviček Orlová', type: 'CHECK' },
    { id: 'order-demo-4', title: 'Převoz tiskovin do skladu', type: 'TRANSPORT' },
    { id: 'order-demo-5', title: 'Servis reklamního nosiče', type: 'REPAIR' }
  ] as const;

  for (const o of ordersData) {
    await prisma.workOrder.create({
      data: {
        id: o.id,
        title: o.title,
        description: 'DEMO ZAKÁZKA',
        status: 'NEW',
        priority: 'NORMAL',
        workType: o.type as WorkType,
        scheduledAt: new Date('2026-06-15T08:00:00.000Z'),
        clientName: demoClient.name,
        clientId: demoClient.id
      }
    });
  }

  await prisma.workTask.create({
    data: { id: 'task-demo-1', title: 'Instalace cityposterů', workOrderId: 'order-demo-1', remunerationMethod: 'TASK' }
  });
  await prisma.workTask.create({
    data: { id: 'task-demo-2', title: 'Reinstalace reklamních ploch', workOrderId: 'order-demo-2', remunerationMethod: 'TASK' }
  });
  await prisma.workTask.create({
    data: { id: 'task-demo-3', title: 'Kontrola reklamních nosičů', workOrderId: 'order-demo-3', remunerationMethod: 'HOURLY' }
  });
  await prisma.workTask.create({
    data: { id: 'task-demo-4', title: 'Převoz materiálu', workOrderId: 'order-demo-4', remunerationMethod: 'HOURLY' }
  });
  await prisma.workTask.create({
    data: { id: 'task-demo-5', title: 'Oprava nosiče', workOrderId: 'order-demo-5', remunerationMethod: 'FIXED' }
  });
  console.log('Demo zakázky a úkoly vytvořeny.');

  // 7. Create demo WorkEntries (Approved)
  await prisma.workEntry.create({
    data: {
      id: 'we-demo-1',
      employeeId: demoEmp.id,
      workDate: new Date('2026-06-10T10:00:00.000Z'),
      workTaskId: 'task-demo-1',
      workOrderId: 'order-demo-1',
      clientId: demoClient.id,
      clientName: demoClient.name,
      workType: 'INSTALLATION',
      remunerationMethod: 'TASK',
      quantity: 12,
      unit: 'ks',
      appliedUnitRate: 180.00,
      calculatedAmount: 2160.00,
      status: 'APPROVED'
    }
  });

  await prisma.workEntry.create({
    data: {
      id: 'we-demo-2',
      employeeId: demoEmp.id,
      workDate: new Date('2026-06-11T10:00:00.000Z'),
      workTaskId: 'task-demo-2',
      workOrderId: 'order-demo-2',
      clientId: demoClient.id,
      clientName: demoClient.name,
      workType: 'REINSTALLATION',
      remunerationMethod: 'TASK',
      quantity: 8,
      unit: 'ks',
      appliedUnitRate: 150.00,
      calculatedAmount: 1200.00,
      status: 'APPROVED'
    }
  });

  await prisma.workEntry.create({
    data: {
      id: 'we-demo-3',
      employeeId: demoEmp.id,
      workDate: new Date('2026-06-12T10:00:00.000Z'),
      workTaskId: 'task-demo-3',
      workOrderId: 'order-demo-3',
      clientId: demoClient.id,
      clientName: demoClient.name,
      workType: 'CHECK',
      remunerationMethod: 'HOURLY',
      quantity: 6,
      unit: 'hod',
      appliedUnitRate: 220.00,
      calculatedAmount: 1320.00,
      status: 'APPROVED'
    }
  });

  await prisma.workEntry.create({
    data: {
      id: 'we-demo-4',
      employeeId: demoEmp.id,
      workDate: new Date('2026-06-13T10:00:00.000Z'),
      workTaskId: 'task-demo-4',
      workOrderId: 'order-demo-4',
      clientId: demoClient.id,
      clientName: demoClient.name,
      workType: 'TRANSPORT',
      remunerationMethod: 'HOURLY',
      quantity: 4,
      unit: 'hod',
      appliedUnitRate: 220.00,
      calculatedAmount: 880.00,
      status: 'APPROVED'
    }
  });

  await prisma.workEntry.create({
    data: {
      id: 'we-demo-5',
      employeeId: demoEmp.id,
      workDate: new Date('2026-06-14T10:00:00.000Z'),
      workTaskId: 'task-demo-5',
      workOrderId: 'order-demo-5',
      clientId: demoClient.id,
      clientName: demoClient.name,
      workType: 'REPAIR',
      remunerationMethod: 'FIXED',
      quantity: 1,
      unit: 'úkol',
      appliedUnitRate: 750.00,
      calculatedAmount: 750.00,
      status: 'APPROVED'
    }
  });
  console.log('Demo výkazy práce vytvořeny.');

  // 8. Create demo Work Expenses
  await prisma.workExpense.create({
    data: { id: 'exp-demo-1', workEntryId: 'we-demo-1', type: 'PARKING', description: 'Parkovné - centrum', amount: 180.00, status: 'APPROVED' }
  });
  await prisma.workExpense.create({
    data: { id: 'exp-demo-2', workEntryId: 'we-demo-2', type: 'PURCHASE', description: 'Nákup spojovacího materiálu', amount: 460.00, status: 'APPROVED' }
  });
  await prisma.workExpense.create({
    data: { id: 'exp-demo-3', workEntryId: 'we-demo-3', type: 'FUEL', description: 'Pohonné hmoty', amount: 650.00, status: 'PENDING' }
  });
  await prisma.workExpense.create({
    data: { id: 'exp-demo-4', workEntryId: 'we-demo-4', type: 'OTHER', description: 'Oběd s klientem', amount: 300.00, status: 'REJECTED', rejectionReason: 'Výdaj nesouvisí se zakázkou' }
  });
  console.log('Demo výdaje vytvořeny.');

  // 9. Create demo Settlement
  const periodFrom = new Date('2026-05-31T22:00:00.000Z'); // June 1st Prague local
  const periodTo = new Date('2026-06-30T21:59:59.999Z'); // June 30th Prague local

  const demoSettlement = await prisma.settlement.create({
    data: {
      id: 'settlement-demo-novak',
      employeeId: demoEmp.id,
      periodFrom,
      periodTo,
      periodYear: 2026,
      periodMonth: 6,
      status: 'SUBMITTED',
      totalWorkAmount: 6310.00,
      totalReimbursements: 1640.00,
      totalDeductions: 250.00,
      totalAdvances: 2000.00,
      finalPayableAmount: 5700.00,
      totalAmount: 5700.00,
      note: 'DEMO Vyúčtování pro E2E testy'
    }
  });
  console.log(`Demo vyúčtování vytvořeno: ID=${demoSettlement.id}`);

  // 10. Create demo Settlement Items
  await prisma.settlementItem.create({
    data: { id: 'item-demo-1', settlementId: demoSettlement.id, workEntryId: 'we-demo-1', taskId: 'task-demo-1', date: new Date('2026-06-10T10:00:00.000Z'), description: 'Instalace cityposterů', quantity: 12, unit: 'ks', unitPrice: 180.00, amount: 2160.00, appliedRate: 180.00, rateType: 'TASK', rateSource: 'EMPLOYEE_RATE', workType: 'INSTALLATION' }
  });
  await prisma.settlementItem.create({
    data: { id: 'item-demo-2', settlementId: demoSettlement.id, workEntryId: 'we-demo-2', taskId: 'task-demo-2', date: new Date('2026-06-11T10:00:00.000Z'), description: 'Reinstalace reklamních ploch', quantity: 8, unit: 'ks', unitPrice: 150.00, amount: 1200.00, appliedRate: 150.00, rateType: 'TASK', rateSource: 'EMPLOYEE_RATE', workType: 'REINSTALLATION' }
  });
  await prisma.settlementItem.create({
    data: { id: 'item-demo-3', settlementId: demoSettlement.id, workEntryId: 'we-demo-3', taskId: 'task-demo-3', date: new Date('2026-06-12T10:00:00.000Z'), description: 'Kontrola reklamních nosičů', quantity: 6, unit: 'hod', unitPrice: 220.00, amount: 1320.00, appliedRate: 220.00, rateType: 'HOURLY', rateSource: 'EMPLOYEE_RATE', workType: 'CHECK' }
  });
  await prisma.settlementItem.create({
    data: { id: 'item-demo-4', settlementId: demoSettlement.id, workEntryId: 'we-demo-4', taskId: 'task-demo-4', date: new Date('2026-06-13T10:00:00.000Z'), description: 'Převoz materiálu', quantity: 4, unit: 'hod', unitPrice: 220.00, amount: 880.00, appliedRate: 220.00, rateType: 'HOURLY', rateSource: 'EMPLOYEE_RATE', workType: 'TRANSPORT' }
  });
  await prisma.settlementItem.create({
    data: { id: 'item-demo-5', settlementId: demoSettlement.id, workEntryId: 'we-demo-5', taskId: 'task-demo-5', date: new Date('2026-06-14T10:00:00.000Z'), description: 'Oprava nosiče', quantity: 1, unit: 'úkol', unitPrice: 750.00, amount: 750.00, appliedRate: 750.00, rateType: 'FIXED', rateSource: 'EMPLOYEE_RATE', workType: 'REPAIR' }
  });

  // 11. Create demo adjustments
  await prisma.settlementAdjustment.create({
    data: { id: 'adj-demo-1', settlementId: demoSettlement.id, workExpenseId: 'exp-demo-1', type: 'REIMBURSEMENT', category: 'PARKING', description: 'Náhrada výdaje (PARKING): Parkovné - centrum', amount: 180.00 }
  });
  await prisma.settlementAdjustment.create({
    data: { id: 'adj-demo-2', settlementId: demoSettlement.id, workExpenseId: 'exp-demo-2', type: 'REIMBURSEMENT', category: 'PURCHASE', description: 'Náhrada výdaje (PURCHASE): Nákup spojovacího materiálu', amount: 460.00 }
  });
  await prisma.settlementAdjustment.create({
    data: { id: 'adj-demo-3', settlementId: demoSettlement.id, type: 'BONUS', category: 'OTHER', description: 'Bonus za rychlé dokončení zakázky', amount: 1000.00, reason: 'DEMO' }
  });
  await prisma.settlementAdjustment.create({
    data: { id: 'adj-demo-4', settlementId: demoSettlement.id, type: 'ADVANCE', category: 'OTHER', description: 'Záloha vyplená během měsíce', amount: 2000.00, reason: 'DEMO' }
  });
  await prisma.settlementAdjustment.create({
    data: { id: 'adj-demo-5', settlementId: demoSettlement.id, type: 'DEDUCTION', category: 'OTHER', description: 'Drobná srážka nebo korekce', amount: 250.00, reason: 'DEMO' }
  });

  // 12. Create audit logs
  await prisma.settlementAuditLog.create({
    data: { id: 'log-demo-1', settlementId: demoSettlement.id, userId: demoUser.id, userName: 'Jan Novák', action: 'STATUS_CHANGE', fieldName: 'status', oldValue: 'null', newValue: 'DRAFT', reason: 'Vytvoření vyúčtování (automaticky)', createdAt: new Date('2026-06-30T18:00:00.000Z') }
  });
  await prisma.settlementAuditLog.create({
    data: { id: 'log-demo-2', settlementId: demoSettlement.id, userId: demoUser.id, userName: 'Jan Novák', action: 'ITEM_UPDATE', reason: 'Přidání položek práce', createdAt: new Date('2026-06-30T18:05:00.000Z') }
  });
  await prisma.settlementAuditLog.create({
    data: { id: 'log-demo-3', settlementId: demoSettlement.id, userId: demoUser.id, userName: 'Jan Novák', action: 'ADJUSTMENT_ADD', reason: 'Přidání bonusu', createdAt: new Date('2026-06-30T18:10:00.000Z') }
  });
  await prisma.settlementAuditLog.create({
    data: { id: 'log-demo-4', settlementId: demoSettlement.id, userId: demoUser.id, userName: 'Jan Novák', action: 'STATUS_CHANGE', fieldName: 'status', oldValue: 'DRAFT', newValue: 'SUBMITTED', reason: 'Odeslání ke schválení', createdAt: new Date('2026-06-30T18:15:00.000Z') }
  });

  console.log('E2E demo data úspěšně vytvořena!');
  console.log(`Matematický součet:
- Práce: 6310.00 Kč
- Náhrady + Bonusy: 1640.00 Kč
- Srážky: 250.00 Kč
- Zálohy: 2000.00 Kč
- K vyplacení: 5700.00 Kč`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
