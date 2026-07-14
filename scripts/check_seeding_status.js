import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.count();
  const workOrders = await prisma.workOrder.count();
  const workTasks = await prisma.workTask.count();
  const settlements = await prisma.settlement.count();
  
  console.log(`COUNTS IN DB:`);
  console.log(`- Clients: ${clients}`);
  console.log(`- WorkOrders: ${workOrders}`);
  console.log(`- WorkTasks: ${workTasks}`);
  console.log(`- Settlements: ${settlements}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
