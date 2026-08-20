const fs = require('fs');
const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production', 'utf8');
const dbLine = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='));
if (dbLine) {
  const dbUrl = dbLine.split('=')[1].trim().replace(/^["']|["']$/g, '');
  process.env.DATABASE_URL = dbUrl;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.offerPriceRule.findMany();
  console.log('--- OfferPriceRules ---');
  console.dir(rules, { depth: null });

  const items = await prisma.priceListItem.findMany();
  console.log('--- PriceListItems ---');
  console.dir(items, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
