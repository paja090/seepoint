import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { createMediaPackage, listMediaPackages } from '@/lib/offers/media-package-service';

export async function GET() { const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth; try { return NextResponse.json(await listMediaPackages()); } catch (error) { return offerErrorResponse(error); } }
export async function POST(request: Request) { const auth = await requireApiAccess('settings'); if (isApiDenied(auth)) return auth; try { return NextResponse.json(await createMediaPackage(auth, await request.json()), { status: 201 }); } catch (error) { return offerErrorResponse(error); } }
