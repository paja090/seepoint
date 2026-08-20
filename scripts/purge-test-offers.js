const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to purge all test offers...');

  const offerCount = await prisma.offer.count();
  console.log(`Found ${offerCount} test offers in database.`);

  if (offerCount === 0) {
    console.log('No offers found to delete.');
    return;
  }

  const deleteResult = await prisma.offer.deleteMany({});
  console.log(`SUCCESS: Deleted ${deleteResult.count} test offers and associated data.`);

  const remainingCount = await prisma.offer.count();
  console.log(`Remaining offers count: ${remainingCount}`);
}

main()
  .catch((e) => console.error('Error during purge:', e))
  .finally(() => prisma.$disconnect());
