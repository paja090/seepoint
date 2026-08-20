const { createOfferPdf } = require('../lib/offers/pdf');

async function test() {
  try {
    const fakeOffer = {
      id: 'TEST-123',
      title: 'Testovací nabídka',
      client: { name: 'Test Klient' },
      createdAt: '2026-08-20',
      pricing: [{ label: 'Pronájem', amount: 12000 }],
      stats: { total: 12000 },
      carriers: [],
      offerType: 'NAVIGATION',
      rawOffer: {
        navigation: {
          targetLatitude: 49.8,
          targetLongitude: 15.4,
          targetName: 'Test Target',
          points: []
        }
      }
    };
    console.log('Generating PDF...');
    const pdfBuf = await createOfferPdf(fakeOffer);
    console.log('PDF generated successfully! Buffer length:', pdfBuf ? pdfBuf.length : 0);
  } catch (err) {
    console.error('PDF error:', err);
  }
}

test();
