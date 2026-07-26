import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Unlocking advisory locks...');
  await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock_all()`);
  console.log('Advisory locks released.');

  console.log('Resolving _prisma_migrations table...');
  await prisma.$executeRawUnsafe(`
    UPDATE _prisma_migrations 
    SET finished_at = NOW(), 
        applied_steps_count = 1,
        logs = NULL
    WHERE migration_name = '20260726200000_navigation_module' AND finished_at IS NULL
  `);
  console.log('_prisma_migrations updated successfully.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
