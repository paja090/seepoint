require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.navigationOrder.findMany({
    take: 3,
    select: { id: true, status: true, plannedInstallationAt: true, installerUserId: true },
  });
  console.log('SUCCESS: NavigationOrder query with new columns:', orders);

  const points = await prisma.navigationPoint.findMany({
    take: 3,
    select: { id: true, label: true, routeOrder: true, plannedInstallationAt: true, qcStatus: true },
  });
  console.log('SUCCESS: NavigationPoint query with new columns:', points);
}

main().catch((err) => {
  console.error('ERROR in DB query:', err);
}).finally(() => prisma.$disconnect());
