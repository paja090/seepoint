import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createCarrierSurface, listCarrierSurfaces } from '@/lib/navigation/carrier-history-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const carrierId = (await params).id;
    const surfaces = await listCarrierSurfaces(carrierId);
    return NextResponse.json({ success: true, surfaces });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při načítání ploch nosiče' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const carrierId = (await params).id;
    const body = await req.json();

    const surface = await createCarrierSurface({
      carrierId,
      name: body.name || 'Plástev VO',
      sidePosition: body.sidePosition || 'Strana A',
      mediaType: body.mediaType,
      currentClientId: body.currentClientId,
      contractId: body.contractId,
      artworkUrl: body.artworkUrl,
      graphicNotes: body.graphicNotes,
      currentRentStart: body.currentRentStart,
      currentRentEnd: body.currentRentEnd,
      price: body.price,
      note: body.note,
    });

    return NextResponse.json({ success: true, surface });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při vytváření reklamní plochy' }, { status: 400 });
  }
}
