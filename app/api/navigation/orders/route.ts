import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { convertOfferToNavigationOrder, listNavigationOrders } from '@/lib/navigation/navigation-service';

export async function GET(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || undefined;
    const status = searchParams.get('status') || undefined;
    const clientId = searchParams.get('clientId') || undefined;

    const orders = await listNavigationOrders(user, { query, status, clientId });
    return NextResponse.json({ success: true, orders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při načítání navigačních zakázek.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const body = await req.json();
    if (!body.offerId) {
      return NextResponse.json({ error: 'ID nabídky je povinné.' }, { status: 400 });
    }

    const order = await convertOfferToNavigationOrder(body.offerId, user);
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při převodu nabídky na navigační zakázku.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
