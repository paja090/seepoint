import { NextResponse } from 'next/server';
import { carrierMapColor, getCarriers } from '@/lib/db';

export async function GET() {
  const carriers = await getCarriers();
  return NextResponse.json(carriers.map((carrier) => ({
    id: carrier.id,
    name: carrier.name,
    code: carrier.code,
    type: carrier.type,
    latitude: carrier.latitude,
    longitude: carrier.longitude,
    city: carrier.city,
    status: carrier.status,
    color: carrierMapColor(carrier),
  })));
}
