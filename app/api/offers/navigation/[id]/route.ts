import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { saveNavigationOffer } from '@/lib/offers/specialized';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await saveNavigationOffer(auth, await request.json(), (await params).id)); } catch (error) { return offerErrorResponse(error); }
}
