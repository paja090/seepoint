import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { saveFieldTask } from '@/lib/election-removal/tasks';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try {
    const body = await request.json();
    const point = await saveFieldTask(body.campaignId, body, auth.user, body.id);
    return NextResponse.json({ point });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Zápis selhal.' }, { status: 409 }); }
}
export async function GET(request: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const carriers = await prisma.advertisingCarrier.findMany({ where: { organizationId: auth.organizationId, OR: [{ name: { contains: query, mode: 'insensitive' } }, { code: { contains: query, mode: 'insensitive' } }] },
    select: { id: true, name: true, code: true, latitude: true, longitude: true, surfaces: { select: { id: true, name: true } } }, take: 30 });
  return NextResponse.json({ carriers });
}
