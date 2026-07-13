import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { transitionOffer } from '@/lib/offers/service';
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth; try { return NextResponse.json(await transitionOffer(auth, (await params).id, 'SENT')); } catch (error) { return offerErrorResponse(error); } }
