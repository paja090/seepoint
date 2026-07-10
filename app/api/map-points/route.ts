import { NextResponse } from 'next/server';
import { carrierMapColor, getMapCarriers } from '@/lib/db';
import { parseCarrierFilters } from '@/lib/carrier-filters';

export async function GET(req: Request) {
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
