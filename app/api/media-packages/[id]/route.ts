import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { archiveMediaPackage } from '@/lib/offers/media-package-service';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiAccess('settings'); if (isApiDenied(auth)) return auth; try { return NextResponse.json(await archiveMediaPackage(auth, (await params).id)); } catch (error) { return offerErrorResponse(error); } }
