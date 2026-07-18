import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { checkOfferAvailability } from '@/lib/offers/service';

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try {
    return NextResponse.json(await checkOfferAvailability(auth, await request.json()));
  } catch (error) {
    return offerErrorResponse(error);
  }
}
