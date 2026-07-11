import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { upsertSurface } from '@/lib/db';

export async function POST(req: Request) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  return NextResponse.json(await upsertSurface(await req.json()), { status: 201 });
}

export async function PUT(req: Request) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  return NextResponse.json(await upsertSurface(await req.json()));
}
