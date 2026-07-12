import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return NextResponse.json(clients);
}
