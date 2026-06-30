import { NextResponse } from 'next/server';
import { getCarriers, upsertCarrier } from '@/lib/db';

export async function GET() {
  return NextResponse.json(await getCarriers());
}

export async function POST(req: Request) {
  return NextResponse.json(await upsertCarrier(await req.json()), { status: 201 });
}
