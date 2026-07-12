import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { carrierMapColor, getMapCarriers } from '@/lib/db';
import { parseCarrierFilters } from '@/lib/carrier-filters';

export async function GET(req: Request) {
  const auth = await requireApiAccess('map'); if (isApiDenied(auth)) return auth;
  const url = new URL(req.url);
  const { carriers, meta } = await getMapCarriers(parseCarrierFilters(Object.fromEntries(url.searchParams.entries())));
  return NextResponse.json({
    items: carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.name,
      code: carrier.code,
      type: carrier.type,
      latitude: carrier.latitude,
      longitude: carrier.longitude,
      city: carrier.city,
      address: carrier.address,
      locality: carrier.locality ?? carrier.cadastralArea,
      archivedAt: carrier.archivedAt,
      status: carrier.status,
      color: carrierMapColor(carrier),
    })),
    meta,
  });
}
