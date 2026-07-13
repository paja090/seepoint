import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { publishOffer } from '@/lib/offers/service';
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth; try { return NextResponse.json(await publishOffer(auth, (await params).id)); } catch (error) { return offerErrorResponse(error); } }
