import { NextResponse } from 'next/server';
import { deleteCarrier, getCarrier, upsertCarrier } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const carrier = await getCarrier((await params).id);
  return carrier ? NextResponse.json(carrier) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return NextResponse.json(await upsertCarrier({ ...(await req.json()), id: (await params).id }));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteCarrier((await params).id);
  return NextResponse.json({ ok: true });
}
