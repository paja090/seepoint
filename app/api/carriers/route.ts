import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCarriers, upsertCarrier } from '@/lib/db';
import type { Carrier } from '@/lib/types';

export async function GET() {
  return NextResponse.json(await getCarriers());
}

export async function POST(req: Request) {
  try {
    const input = await req.json() as Partial<Carrier>;
    if (!input.name?.trim() || !input.code?.trim() || !input.city?.trim()) {
      return NextResponse.json({ error: 'Vyplňte název, interní kód a město.' }, { status: 400 });
    }
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
      return NextResponse.json({ error: 'Souřadnice nosiče nejsou platné.' }, { status: 400 });
    }

    return NextResponse.json(await upsertCarrier(input), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Nosič s tímto interním kódem už existuje.' }, { status: 409 });
    }
    console.error('[api/carriers] create failed', error);
    return NextResponse.json({ error: 'Nosič se nepodařilo uložit.' }, { status: 500 });
  }
}
