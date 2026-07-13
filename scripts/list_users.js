import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      employee: true
    }
  });
  console.log('USERS IN DB:');
  for (const u of users) {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Status: ${u.status}, Name: ${u.name}`);
    if (u.employee) {
      console.log(`  Employee Profile: ${u.employee.firstName} ${u.employee.lastName}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
