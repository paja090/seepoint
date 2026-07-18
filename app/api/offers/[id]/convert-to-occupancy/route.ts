import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { convertOfferToOccupancy } from '@/lib/offers/service';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth; try { const body = await request.json().catch(() => ({})) as { targetStatus?: unknown }; const target = body.targetStatus === 'RESERVED' ? 'RESERVED' : 'OCCUPIED'; return NextResponse.json(await convertOfferToOccupancy(auth, (await params).id, target)); } catch (error) { return offerErrorResponse(error); } }
