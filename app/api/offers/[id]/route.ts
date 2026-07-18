import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { archiveOffer, getOffer, updateOffer } from '@/lib/offers/service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await getOffer(auth, (await params).id)); } catch (error) { return offerErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await updateOffer(auth, (await params).id, await request.json())); } catch (error) { return offerErrorResponse(error); }
}

export async function DELETE(_: Request, { params }: Context) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await archiveOffer(auth, (await params).id)); } catch (error) { return offerErrorResponse(error); }
}
