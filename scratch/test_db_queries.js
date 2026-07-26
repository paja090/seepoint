import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing NavigationOrder list query...');
    const orders = await prisma.navigationOrder.findMany({
      take: 5,
      include: {
        crmOrder: {
          include: {
            client: { select: { id: true, name: true } },
            assignedUser: { select: { id: true, name: true } },
          },
        },
        points: true,
        billingPeriods: true,
      },
    });
    console.log('Successfully fetched navigation orders count:', orders.length);
  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
