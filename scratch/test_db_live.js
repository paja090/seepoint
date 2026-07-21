require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('SUCCESS: Users in DB:', users.length, users);
  const surfaces = await prisma.advertisingSurface.findMany({
    take: 2,
    select: { id: true, name: true, destinationName: true, distanceMeters: true },
  });
  console.log('SUCCESS: Surface query succeeded:', surfaces);
}

main().catch(console.error).finally(() => prisma.$disconnect());
