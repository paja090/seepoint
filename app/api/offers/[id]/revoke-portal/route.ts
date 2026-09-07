import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('offers');
  if (isApiDenied(user)) return user;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Pouze administrátor.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirmed !== true || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 2000) {
    return NextResponse.json({ error: 'Potvrďte zneplatnění odkazu a uveďte důvod.' }, { status: 400 });
  }
  const { id } = await params;
  const changed = await prisma.$transaction(async tx => {
    const result = await tx.offer.updateMany({ where: { id, publicTokenRevokedAt: null }, data: { publicTokenRevokedAt: new Date() } });
    if (result.count) await tx.offerEvent.create({ data: {
      offerId: id, organizationId: user.organizationId!, type: 'QUESTION', actorUserId: user.id, actorName: user.name,
      message: 'Nouzové zneplatnění veřejného odkazu', metadata: { securityAction: 'PORTAL_REVOKED', reason: body.reason.trim() },
    } });
    return result.count;
  });
  return NextResponse.json({ revoked: changed === 1 }, { status: changed ? 200 : 404 });
}
