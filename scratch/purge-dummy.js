const fs = require('fs');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

let envConfig = {};
try {
  if (fs.existsSync('.env.local')) {
    envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  } else if (fs.existsSync('.env')) {
    envConfig = dotenv.parse(fs.readFileSync('.env'));
  }
} catch (e) {}

for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (dbUrl) process.env.DATABASE_URL = dbUrl;

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function main() {
  const deleted = await prisma.salesOpportunity.deleteMany({
    where: {
      OR: [
        { companyName: 'Nový potenciální klient' },
        { title: { contains: 'Nový potenciální klient', mode: 'insensitive' } },
      ],
    },
  });
  console.log('Successfully purged dummy test opportunities:', deleted);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
