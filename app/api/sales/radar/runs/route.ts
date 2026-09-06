import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const runs = await prisma.radarRun.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ runs });
  } catch (err) {
    console.error('Failed to get radar runs', err);
    return NextResponse.json({ error: 'Chyba při načítání historie běhů radaru.' }, { status: 500 });
  }
}
