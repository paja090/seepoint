import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { updateOfferPriceRule } from '@/lib/offers/price-rules';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await updateOfferPriceRule(auth, (await params).id, await request.json())); } catch (error) { return offerErrorResponse(error); }
}
