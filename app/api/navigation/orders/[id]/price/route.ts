import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { changeNavigationPointPrice, deleteNavigationPrice } from '@/lib/navigation/pricing-service';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const body = await req.json();
    const { navigationPointId, newUnitPrice, effectiveDate, reason, applyFromNextPeriod } = body;

    if (!navigationPointId || newUnitPrice === undefined || !effectiveDate || !reason) {
      return NextResponse.json(
        { error: 'Chybí povinné údaje: navigationPointId, newUnitPrice, effectiveDate, reason.' },
        { status: 400 }
      );
    }

    const updated = await changeNavigationPointPrice(
      { navigationPointId, newUnitPrice, effectiveDate, reason, applyFromNextPeriod },
      user.id,
      user.name
    );

    return NextResponse.json({ success: true, point: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při změně ceny bodu.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiAccess('offers');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const navigationPointId = searchParams.get('navigationPointId');

    if (!navigationPointId) {
      return NextResponse.json({ error: 'Chybí navigationPointId.' }, { status: 400 });
    }

    const result = await deleteNavigationPrice(navigationPointId, user.id);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při mazání ceny bodu.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
