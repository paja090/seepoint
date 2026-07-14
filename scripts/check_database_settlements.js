import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settlements = await prisma.settlement.findMany({
    include: {
      employee: true,
      items: true,
      adjustments: true
    }
  });

  console.log(`TOTAL SETTLEMENTS IN DB: ${settlements.length}`);
  for (const s of settlements) {
    console.log(`- ID: ${s.id}, Employee: ${s.employee.firstName} ${s.employee.lastName} (${s.employee.email}), Period: ${s.periodYear}/${s.periodMonth}, Status: ${s.status}, finalPayableAmount: ${s.finalPayableAmount}`);
    console.log(`  Items: ${s.items.length}, Adjustments: ${s.adjustments.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
