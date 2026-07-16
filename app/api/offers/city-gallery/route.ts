import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { createCityGalleryOffer } from '@/lib/offers/specialized';

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await createCityGalleryOffer(auth, await request.json()), { status: 201 }); } catch (error) { return offerErrorResponse(error); }
}
