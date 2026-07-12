import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

function requireSeedConfig() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim();

  const invalid = [];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid.push('SEED_ADMIN_EMAIL');
  if (!password || password.length < 12 || !/[a-z]/i.test(password) || !/\d/.test(password)) invalid.push('SEED_ADMIN_PASSWORD');
  if (!name) invalid.push('SEED_ADMIN_NAME');

  if (invalid.length > 0) {
    throw new Error(`Chybějící nebo neplatné proměnné: ${invalid.join(', ')}`);
  }

  return { email, password, name };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

async function main() {
  const { email, password, name } = requireSeedConfig();
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const admin = await tx.user.upsert({
      where: { email },
      update: {
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash,
        sessionVersion: { increment: 1 },
      },
      create: {
        name,
        email,
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.session.deleteMany({ where: { userId: admin.id } });
    }
  });

  console.log('První administrátor byl bezpečně vytvořen nebo aktualizován.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Vytvoření administrátora selhalo.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
