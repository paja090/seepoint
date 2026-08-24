import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

let sampleSettlements = [
  {
    id: 'set-2026-08-01',
    period: 'Srpen 2026',
    partnerId: 'org-brno',
    partnerName: 'Outdoor Media Brno s.r.o.',
    type: 'PAYABLE', // My platíme partnerovi za jeho plochy v Brně
    itemsCount: 4,
    clientBilledAmount: 34000,
    wholesaleB2BAmount: 27200,
    netMarginAmount: 6800,
    marginPercent: 20,
    status: 'INVOICED',
    invoiceNumber: 'B2B-2026-0842',
    dueDate: '2026-09-15',
    items: [
      { code: 'BRN-BB-04', name: 'Eurobillboard Sportovní', clientPrice: 8500, b2bPrice: 6800, margin: 1700 },
      { code: 'BRN-BB-09', name: 'Eurobillboard Vídeňská', clientPrice: 8500, b2bPrice: 6800, margin: 1700 },
      { code: 'BRN-PB-02', name: 'Promo lavička Hlavní nádraží', clientPrice: 3500, b2bPrice: 2800, margin: 700 },
      { code: 'BRN-CLV-01', name: 'CLV Vitrína Náměstí Svobody', clientPrice: 13500, b2bPrice: 10800, margin: 2700 },
    ],
  },
  {
    id: 'set-2026-08-02',
    period: 'Srpen 2026',
    partnerId: 'org-ostrava',
    partnerName: 'Ostrava Outdoor s.r.o.',
    type: 'RECEIVABLE', // Partner nám platí za naše plochy v Praze
    itemsCount: 2,
    clientBilledAmount: 18000,
    wholesaleB2BAmount: 14400,
    netMarginAmount: 14400, // Náš příjem za pronájem naší plochy
    marginPercent: 20,
    status: 'PENDING',
    invoiceNumber: null,
    dueDate: '2026-09-20',
    items: [
      { code: 'PHA-PB-12', name: 'Promo lavička Vinohradská', clientPrice: 3000, b2bPrice: 2400, margin: 2400 },
      { code: 'PHA-BB-01', name: 'Eurobillboard Chodovská', clientPrice: 15000, b2bPrice: 12000, margin: 12000 },
    ],
  },
  {
    id: 'set-2026-07-01',
    period: 'Červenec 2026',
    partnerId: 'org-plzen',
    partnerName: 'Plzeň Billboard Group s.r.o.',
    type: 'PAYABLE',
    itemsCount: 3,
    clientBilledAmount: 25500,
    wholesaleB2BAmount: 20400,
    netMarginAmount: 5100,
    marginPercent: 20,
    status: 'SETTLED',
    invoiceNumber: 'B2B-2026-0719',
    dueDate: '2026-08-15',
    items: [
      { code: 'PLZ-BB-01', name: 'Billboard Rokycanská', clientPrice: 8500, b2bPrice: 6800, margin: 1700 },
      { code: 'PLZ-BB-02', name: 'Billboard Domažlická', clientPrice: 8500, b2bPrice: 6800, margin: 1700 },
      { code: 'PLZ-BB-03', name: 'Billboard Klatovská', clientPrice: 8500, b2bPrice: 6800, margin: 1700 },
    ],
  },
];

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  const totalB2BRevenue = sampleSettlements.reduce((acc, s) => acc + s.clientBilledAmount, 0);
  const totalNetMargin = sampleSettlements.reduce((acc, s) => acc + s.netMarginAmount, 0);
  const totalPayable = sampleSettlements.filter((s) => s.type === 'PAYABLE' && s.status !== 'SETTLED').reduce((acc, s) => acc + s.wholesaleB2BAmount, 0);
  const totalReceivable = sampleSettlements.filter((s) => s.type === 'RECEIVABLE' && s.status !== 'SETTLED').reduce((acc, s) => acc + s.wholesaleB2BAmount, 0);

  return NextResponse.json({
    success: true,
    metrics: {
      totalB2BRevenue,
      totalNetMargin,
      totalPayable,
      totalReceivable,
    },
    settlements: sampleSettlements,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { settlementId, action } = body;

    if (action === 'GENERATE_INVOICE') {
      sampleSettlements = sampleSettlements.map((s) =>
        s.id === settlementId
          ? { ...s, status: 'INVOICED', invoiceNumber: `B2B-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}` }
          : s
      );
      return NextResponse.json({
        success: true,
        message: 'Fakturační B2B podklad byl úspěšně vygenerován!',
        status: 'INVOICED',
      });
    }

    if (action === 'MARK_SETTLED') {
      sampleSettlements = sampleSettlements.map((s) =>
        s.id === settlementId ? { ...s, status: 'SETTLED' } : s
      );
      return NextResponse.json({
        success: true,
        message: 'Vyúčtování bylo označeno jako uhrazené a vyrovnané.',
        status: 'SETTLED',
      });
    }

    return NextResponse.json({ success: false, error: 'Neznámá akce.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/network/settlements]', error);
    return NextResponse.json({ success: false, error: 'Operaci se nepodařilo provést.' }, { status: 500 });
  }
}
