import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    include: {
      user: true
    }
  });
  console.log('EMPLOYEES IN DB:');
  for (const e of employees) {
    console.log(`- ID: ${e.id}, Name: ${e.firstName} ${e.lastName}, Email: ${e.email}, Role: ${e.role}`);
    if (e.user) {
      console.log(`  User: ID=${e.user.id}, Role=${e.user.role}, Status=${e.user.status}`);
    } else {
      console.log(`  No associated user account`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
