import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { validateOfferBeforeSend } from '@/lib/offers/service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const result = await validateOfferBeforeSend(auth, id);
    return NextResponse.json(result);
  } catch (error) {
    return offerErrorResponse(error);
  }
}
