import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicOffer } from '@/lib/offers/service';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) { try { return NextResponse.json(await getPublicOffer((await params).token), { headers: { 'Cache-Control': 'private, no-store' } }); } catch (error) { return offerErrorResponse(error); } }
