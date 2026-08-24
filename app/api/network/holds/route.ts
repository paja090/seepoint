import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { requireTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  // Mocked active holds for demonstration in B2B hub
  const holds = [
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
      expiresAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      status: 'ACTIVE_HOLD',
      daysLeft: 4,
    },
  ];

  return NextResponse.json({
    success: true,
    holds,
  });
}

export async function POST(req: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { surfaceId, action } = body;

    return NextResponse.json({
      success: true,
      message:
        action === 'RELEASE'
          ? 'B2B Hold byl úspěšně uvolněn.'
          : 'Dočasná B2B rezervace (Hold na 5 dní) byla úspěšně vytvořena.',
      surfaceId,
    });
  } catch (error: unknown) {
    console.error('[api/network/holds]', error);
    return NextResponse.json({ success: false, error: 'Akci se nepodařilo provést.' }, { status: 500 });
  }
}
