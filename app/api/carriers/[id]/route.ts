import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { deleteCarrier, getCarrier, upsertCarrier } from '@/lib/db';
import type { Carrier } from '@/lib/types';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  const carrier = await getCarrier((await params).id);
  return carrier ? NextResponse.json(carrier) : NextResponse.json({ error: 'Nosič nebyl nalezen.' }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  try {
    const input = await req.json() as Partial<Carrier>;
    const hasLatitude = input.latitude !== undefined && input.latitude !== null;
    const hasLongitude = input.longitude !== undefined && input.longitude !== null;

    if (hasLatitude !== hasLongitude) {
      return NextResponse.json({ error: 'Vyplňte obě GPS souřadnice.' }, { status: 400 });
    }
    if (hasLatitude && hasLongitude) {
      if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)
        || input.latitude! < -90 || input.latitude! > 90
        || input.longitude! < -180 || input.longitude! > 180) {
        return NextResponse.json({ error: 'GPS souřadnice nejsou platné.' }, { status: 400 });
      }
    }

    const id = (await params).id;
    return NextResponse.json(await upsertCarrier({
      ...input,
      id,
      ...(hasLatitude && hasLongitude ? { gpsStatus: input.gpsStatus ?? 'VERIFIED' } : {}),
    }));
  } catch (error) {
    console.error('[api/carriers/:id] update failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  if (req.headers.get('x-seepoint-admin-confirm') !== 'hard-delete-empty-carrier') {
    return NextResponse.json({ error: 'Fyzické smazání je vypnuté. Použijte archivaci nosiče.' }, { status: 403 });
  }
  try {
    await deleteCarrier((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nosič se nepodařilo smazat.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
