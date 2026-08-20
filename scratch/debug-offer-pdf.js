const fs = require('fs');
const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getPublicOffer } = require('../lib/offers/service');
const { toProposalOffer } = require('../lib/offers/presentation');
const { createOfferPdf } = require('../lib/offers/pdf');

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
    
    console.log('Found offer:', offerRow.id, offerRow.publicTokenHash ? 'has public token' : 'no public token');
    const token = offerRow.id;
    const offerView = await getPublicOffer(token);
    console.log('Got offer view. Points count:', offerView.navigation?.points?.length);
    
    const proposalOffer = toProposalOffer(offerView);
    console.log('Converted to proposal offer. Raw offer present:', !!proposalOffer.rawOffer);
    
    console.log('Calling createOfferPdf...');
    const pdfBuf = await createOfferPdf(proposalOffer);
    console.log('SUCCESS! PDF Buffer length:', pdfBuf.length);
  } catch (err) {
    console.error('CRASH IN PDF GENERATION:');
    console.error(err);
  }
}

debugLatestOffer().catch(console.error).finally(() => prisma.$disconnect());
