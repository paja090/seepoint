import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { convertOfferToCrmOrder } from '@/lib/crm/order-service';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const body = await req.json();
    if (!body.offerId) {
      return NextResponse.json({ error: 'ID nabídky je povinné.' }, { status: 400 });
    }

    const order = await convertOfferToCrmOrder(body.offerId, user.id, user.email);
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Chyba při převodu nabídky na zakázku.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
