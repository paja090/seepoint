import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { duplicateOffer } from '@/lib/offers/service';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  try { return NextResponse.json(await duplicateOffer(auth, (await params).id), { status: 201 }); } catch (error) { return offerErrorResponse(error); }
}
