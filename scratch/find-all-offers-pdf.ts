import fs from 'fs';

const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
});

import { PrismaClient } from '@prisma/client';
import { getPublicOffer } from '@/lib/offers/service';
import { toProposalOffer } from '@/lib/offers/presentation';
import { createOfferPdf } from '@/lib/offers/pdf';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function testAllOffers() {
  console.log('Fetching all offers from DB...');
  const offers = await prisma.offer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`Found ${offers.length} recent offers.`);

  for (const offerRow of offers) {
    console.log(`\n========================================`);
    console.log(`Testing Offer ID: ${offerRow.id} | Type: ${offerRow.offerType} | Status: ${offerRow.status} | TokenHash: ${offerRow.publicTokenHash ? 'YES' : 'NO'}`);

    try {
      // Test with offerId
      const offerView = await getPublicOffer(offerRow.id);
      console.log(`- getPublicOffer OK. Points count: ${offerView.navigation?.points?.length ?? 0}`);

      const proposalOffer = toProposalOffer(offerView);
      console.log(`- toProposalOffer OK. Pricing length: ${proposalOffer.pricing.length}`);

      const pdfBuf = await createOfferPdf(proposalOffer);
      console.log(`- createOfferPdf SUCCESS! Buffer bytes: ${pdfBuf.length}`);
    } catch (err: unknown) {
      console.error(`❌ CRASH FOR OFFER ${offerRow.id}:`, err);
    }
  }
}

testAllOffers().catch(console.error).finally(() => prisma.$disconnect());
