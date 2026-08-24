import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

let sampleDemands = [
  {
    id: 'dem-001',
    direction: 'OUTGOING', // Naše poptávka do sítě
    requesterOrg: 'SeePOINT Praha',
    title: 'Hledáme 4× Eurobillboard v Liberci a Jablonci',
    city: 'Liberec & Jablonec n. N.',
    mediaType: 'BILLBOARD',
    period: 'Září – Říjen 2026',
    quantityNeeded: 4,
    budgetMax: 36000,
    clientSegment: 'Automotive / Dealerství',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    bidsCount: 3,
    bids: [
      { id: 'bid-1', partnerName: 'Severočeská Reklama s.r.o.', offeredSurfacesCount: 2, totalB2BPrice: 15600, note: 'Plochy u OC Nisa a u sjezdu z D10.' },
      { id: 'bid-2', partnerName: 'Outdoor Liberec Group', offeredSurfacesCount: 2, totalB2BPrice: 16400, note: 'Velmi frekventovaný tah Jablonecká ulice.' },
    ],
  },
  {
    id: 'dem-002',
    direction: 'INCOMING', // Poptávka od partnera z Moravy
    requesterOrg: 'Outdoor Media Brno s.r.o.',
    title: 'Poptávka 6× Promo lavičky v Praze (Centrum / Vinohrady)',
    city: 'Praha',
    mediaType: 'PROMO_BENCH',
    period: 'Říjen 2026',
    quantityNeeded: 6,
    budgetMax: 22000,
    clientSegment: 'Kultura & Divadla',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    bidsCount: 1,
    bids: [
      { id: 'bid-3', partnerName: 'SeePOINT Praha (Vy)', offeredSurfacesCount: 6, totalB2BPrice: 16800, note: 'Máme volné lavičky na Vinohradské a Náměstí Míru.' },
    ],
  },
  {
    id: 'dem-003',
    direction: 'INCOMING',
    requesterOrg: 'Plzeň Billboard Group s.r.o.',
    title: 'Hledáme 2× CLV vitríny v Hradci Králové na Hlavním nádraží',
    city: 'Hradec Králové',
    mediaType: 'CITYLIGHT',
    period: 'Listopad 2026',
    quantityNeeded: 2,
    budgetMax: 28000,
    clientSegment: 'Bankovnictví & FinTech',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    bidsCount: 0,
    bids: [],
  },
];

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  return NextResponse.json({
    success: true,
    demands: sampleDemands,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { action, demandData, demandId, bidData } = body;

    if (action === 'CREATE_DEMAND' && demandData) {
      const newDemand = {
        id: `dem-${Date.now()}`,
        direction: 'OUTGOING' as const,
        requesterOrg: 'SeePOINT Praha',
        title: demandData.title || 'Nová poptávka kapacit',
        city: demandData.city || 'Česká republika',
        mediaType: demandData.mediaType || 'BILLBOARD',
        period: demandData.period || 'Dle dohody',
        quantityNeeded: Number(demandData.quantityNeeded) || 1,
        budgetMax: Number(demandData.budgetMax) || 20000,
        clientSegment: demandData.clientSegment || 'Obecná kampaň',
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        bidsCount: 0,
        bids: [],
      };
      sampleDemands = [newDemand, ...sampleDemands];
      return NextResponse.json({
        success: true,
        message: 'Vaše poptávka byla úspěšně odeslána partnerům do B2B sítě!',
        demand: newDemand,
      });
    }

    if (action === 'SUBMIT_BID' && demandId) {
      sampleDemands = sampleDemands.map((d) => {
        if (d.id === demandId) {
          const newBid = {
            id: `bid-${Date.now()}`,
            partnerName: 'SeePOINT Praha (Vy)',
            offeredSurfacesCount: Number(bidData?.offeredSurfacesCount) || 2,
            totalB2BPrice: Number(bidData?.totalB2BPrice) || 15000,
            note: bidData?.note || 'Nabízíme naše volné kapacity.',
          };
          return {
            ...d,
            bidsCount: d.bidsCount + 1,
            bids: [newBid, ...d.bids],
          };
        }
        return d;
      });

      return NextResponse.json({
        success: true,
        message: 'Vaše nabídka kapacit byla odeslána zadavateli poptávky!',
      });
    }

    return NextResponse.json({ success: false, error: 'Neznámá akce.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/network/demands]', error);
    return NextResponse.json({ success: false, error: 'Nepodařilo se zpracovat poptávku.' }, { status: 500 });
  }
}
