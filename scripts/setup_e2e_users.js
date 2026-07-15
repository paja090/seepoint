import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-crypto.ts';

const prisma = new PrismaClient();

async function main() {
  const pw = 'Password12345';
  const hashedPw = await hashPassword(pw);

  // 1. Setup Worker
  const workerEmail = 'worker@seepoint.cz';
  const workerUser = await prisma.user.upsert({
    where: { email: workerEmail },
    update: {
      name: 'Pavel Pracovnik',
      role: 'WORKER',
      status: 'ACTIVE',
      passwordHash: hashedPw
    },
    create: {
      email: workerEmail,
      name: 'Pavel Pracovnik',
      role: 'WORKER',
      status: 'ACTIVE',
      passwordHash: hashedPw
    }
  });

  const workerEmp = await prisma.employee.upsert({
    where: { email: workerEmail },
    update: {
      firstName: 'Pavel',
      lastName: 'Pracovnik',
      role: 'WORKER',
      userId: workerUser.id,
      isActive: true
    },
    create: {
      email: workerEmail,
      firstName: 'Pavel',
      lastName: 'Pracovnik',
      role: 'WORKER',
      userId: workerUser.id,
      isActive: true
    }
  });

  console.log(`WORKER USER: Email=${workerUser.email}, ID=${workerUser.id}`);
  console.log(`WORKER EMPLOYEE: Email=${workerEmp.email}, ID=${workerEmp.id}, UserID=${workerEmp.userId}`);

  // 2. Setup Manager
  const managerEmail = 'manager@seepoint.cz';
  const managerUser = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      name: 'Milan Manager',
      role: 'MANAGER',
      status: 'ACTIVE',
      passwordHash: hashedPw
    },
    create: {
      email: managerEmail,
      name: 'Milan Manager',
      role: 'MANAGER',
      status: 'ACTIVE',
      passwordHash: hashedPw
    }
  });

  const managerEmp = await prisma.employee.upsert({
    where: { email: managerEmail },
    update: {
      firstName: 'Milan',
      lastName: 'Manager',
      role: 'MANAGER',
      userId: managerUser.id,
      isActive: true
    },
    create: {
      email: managerEmail,
      firstName: 'Milan',
      lastName: 'Manager',
      role: 'MANAGER',
      userId: managerUser.id,
      isActive: true
    }
  });

  console.log(`MANAGER USER: Email=${managerUser.email}, ID=${managerUser.id}`);
  console.log(`MANAGER EMPLOYEE: Email=${managerEmp.email}, ID=${managerEmp.id}, UserID=${managerEmp.userId}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
