import fs from 'fs';

const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production', 'utf8');
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

const prisma = new PrismaClient();

async function debugLatestOffer() {
  try {
    const offerRow = await prisma.offer.findFirst({
      where: { offerType: 'NAVIGATION' },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!offerRow) {
      console.log('No navigation offer found.');
      return;
    }
    
    console.log('Found offer ID:', offerRow.id);
    const token = offerRow.id;
    const offerView = await getPublicOffer(token);
    console.log('Got offer view. Points count:', offerView.navigation?.points?.length);
    
    const proposalOffer = toProposalOffer(offerView);
    console.log('Converted to proposal offer. Pricing length:', proposalOffer.pricing.length);
    
    console.log('Calling createOfferPdf...');
    const pdfBuf = await createOfferPdf(proposalOffer);
    console.log('SUCCESS! PDF Buffer length:', pdfBuf ? pdfBuf.length : 0);
  } catch (err) {
    console.error('CRASH IN PDF GENERATION:');
    console.error(err);
  }
}

debugLatestOffer().catch(console.error).finally(() => prisma.$disconnect());
