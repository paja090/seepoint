import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { CrmOrderConversionError, convertOfferToCrmOrder } from '@/lib/crm/order-service';
import { canConvertOfferRole } from '@/lib/offers/domain';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  if (!canConvertOfferRole(user.role)) {
    return NextResponse.json({ error: 'Převod může provést pouze administrátor nebo manažer.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const offerId = typeof body?.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) {
      return NextResponse.json({ error: 'ID nabídky je povinné.' }, { status: 400 });
    }

    const order = await convertOfferToCrmOrder(offerId, user.id, user.email);
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Chyba při převodu nabídky na zakázku.';
    const status = err instanceof CrmOrderConversionError ? err.status : 500;
    return NextResponse.json({ error: errorMsg }, { status });
  }
}
