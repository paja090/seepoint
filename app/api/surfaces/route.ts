import { NextResponse } from 'next/server';
import { upsertSurface } from '@/lib/db';

export async function POST(req: Request) {
  return NextResponse.json(await upsertSurface(await req.json()), { status: 201 });
}

export async function PUT(req: Request) {
  return NextResponse.json(await upsertSurface(await req.json()));
}
