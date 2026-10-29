import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findCadastralParcelByCoords } from '@/lib/cadastre/cuzk-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { error: 'Chybí souřadnice lat a lng' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: 'Neplatný formát souřadnic' },
      { status: 400 }
    );
  }

  try {
    const parcel = await findCadastralParcelByCoords(lat, lng);
    if (!parcel) {
      return NextResponse.json(
        { parcel: null, message: 'Na daných souřadnicích nebyla v katastru nalezena parcela.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ parcel }, { status: 200 });
  } catch (error) {
    console.error('[API/cadastre/identify] Error:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst data z Katastru nemovitostí' },
      { status: 500 }
    );
  }
}
