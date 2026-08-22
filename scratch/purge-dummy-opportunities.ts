import { prisma } from '../lib/db';

async function main() {
  const deleted = await prisma.salesOpportunity.deleteMany({
    where: {
      OR: [
        { companyName: 'Nový potenciální klient' },
        { title: { contains: 'Nový potenciální klient', mode: 'insensitive' } },
      ],
    },
  });

  console.log('Purged dummy test opportunities:', deleted);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
