import { PrismaClient } from '@prisma/client';
import { createOpportunity } from '../lib/opportunities/service';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.findFirst({ select: { id: true } });
  if (!organization) throw new Error('No organization found for sample opportunity.');
  const result = await createOpportunity({
    companyName: 'Primark Ostrava',
    eventType: 'STORE_OPENING',
    title: 'Otevření nové prodejny Primark v OC Karolina',
    summary: 'Společnost Primark oficiálně potvrdila otevření své první prodejny v Moravskoslezském kraji v obchodním centru Forum Nova Karolina Ostrava. Očekává se vysoká návštěvnost a potřeba intenzivní regionální kampaně.',
    city: 'Ostrava',
    region: 'Moravskoslezský kraj',
    address: 'Jantarová 3344/4, Ostrava-Karolina',
    eventDate: new Date('2026-10-15'),
    sourceUrl: 'https://patriotmagazin.cz/primark-otevire-v-ostrave-v-oc-karolina',
    sourceTitle: 'Patriot Magazín — Primark míří do Ostravy',
    suggestedMediaTypes: ['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION_SIGN'],
  }, organization.id);

  console.log('Seeded sample opportunity:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
