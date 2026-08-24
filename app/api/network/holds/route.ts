import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

// In-memory / transactional mock hold store for real-time demonstration
let activeHolds = [
  {
    id: 'hold-101',
    direction: 'OUTGOING', // Odchozí: My rezervujeme cizí plochu
    partnerName: 'Outdoor Media Brno s.r.o.',
    surfaceName: 'Strana A (Eurobillboard)',
    carrierCode: 'BRN-BB-04',
    city: 'Brno',
    street: 'Hradecká / Sportovní',
    b2bPrice: 6800,
    clientPrice: 8500,
    marginCzk: 1700,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: 'ACTIVE_HOLD',
    daysLeft: 3,
  },
  {
    id: 'hold-102',
    direction: 'INCOMING', // Příchozí: Partner si drží naši plochu v Praze
    partnerName: 'Ostrava Outdoor s.r.o.',
    surfaceName: 'Strana A (Promo lavička)',
    carrierCode: 'PHA-PB-12',
    city: 'Praha',
    street: 'Vinohradská 88',
    b2bPrice: 2400,
    clientPrice: 3000,
    marginCzk: 2400,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1 * 86400000).toISOString(),
    status: 'ACTIVE_HOLD',
    daysLeft: 1, // Expiring soon!
  },
];

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  return NextResponse.json({
    success: true,
    holds: activeHolds,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { holdId, surfaceId, action, reason } = body;

    if (action === 'CONFIRM') {
      activeHolds = activeHolds.map((h) =>
        h.id === holdId ? { ...h, status: 'CONFIRMED' } : h
      );
      return NextResponse.json({
        success: true,
        message: 'B2B Rezervace byla úspěšně potvrzena do závazné zakázky!',
        status: 'CONFIRMED',
      });
    }

    if (action === 'EXTEND') {
      activeHolds = activeHolds.map((h) =>
        h.id === holdId
          ? {
              ...h,
              expiresAt: new Date(new Date(h.expiresAt).getTime() + 3 * 86400000).toISOString(),
              daysLeft: h.daysLeft + 3,
            }
          : h
      );
      return NextResponse.json({
        success: true,
        message: 'B2B Hold byl úspěšně prodloužen o 3 dny.',
        status: 'ACTIVE_HOLD',
      });
    }

    if (action === 'RELEASE') {
      activeHolds = activeHolds.filter((h) => h.id !== holdId && h.surfaceId !== surfaceId);
      return NextResponse.json({
        success: true,
        message: 'B2B Hold byl uvolněn a plocha je opět plně dostupná pro ostatní.',
        status: 'RELEASED',
      });
    }

    if (action === 'CREATE') {
      const newHold = {
        id: `hold-${Date.now().toString().slice(-4)}`,
        direction: 'OUTGOING',
        partnerName: 'Outdoor Media Partner s.r.o.',
        surfaceName: 'Strana A (Plocha ze sítě)',
        carrierCode: 'NET-01',
        city: 'Brno',
        street: 'Vídeňská 120',
        b2bPrice: 6500,
        clientPrice: 8500,
        marginCzk: 2000,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: 'ACTIVE_HOLD',
        daysLeft: 5,
      };
      activeHolds.unshift(newHold);
      return NextResponse.json({
        success: true,
        message: 'Dočasná B2B rezervace (Hold na 5 dní) byla úspěšně vytvořena.',
        hold: newHold,
      });
    }

    return NextResponse.json({ success: false, error: 'Neznámá akce.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/network/holds]', error);
    return NextResponse.json({ success: false, error: 'Akci se nepodařilo provést.' }, { status: 500 });
  }
}
