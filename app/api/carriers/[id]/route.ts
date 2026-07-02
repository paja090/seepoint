import { NextResponse } from 'next/server';
import { deleteCarrier, getCarrier, upsertCarrier } from '@/lib/db';
import type { Carrier } from '@/lib/types';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const carrier = await getCarrier((await params).id);
  return carrier ? NextResponse.json(carrier) : NextResponse.json({ error: 'Nosič nebyl nalezen.' }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await req.json() as Partial<Carrier>;
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;

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

  return NextResponse.json(await upsertCarrier({ ...input, id: (await params).id }));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteCarrier((await params).id);
  return NextResponse.json({ ok: true });
}
