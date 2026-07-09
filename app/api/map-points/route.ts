import { NextResponse } from 'next/server';
import { carrierMapColor, getCarriers } from '@/lib/db';
import { parseCarrierFilters } from '@/lib/carrier-filters';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const carriers = await getCarriers(parseCarrierFilters(Object.fromEntries(url.searchParams.entries())));
  return NextResponse.json(carriers.map((carrier) => ({
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
  })));
}
