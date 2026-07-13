import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOffer, listOffers } from '@/lib/offers/service';
import { offerErrorResponse } from '@/lib/offers/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try {
    return NextResponse.json(await listOffers(auth, new URL(request.url).searchParams));
  } catch (error) {
    return offerErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const intent = body.intent === 'send' ? 'send' : 'draft';
    return NextResponse.json(await createOffer(auth, body, intent), { status: 201 });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
