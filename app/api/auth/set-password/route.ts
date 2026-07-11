import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { hashPassword, hashToken, validatePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isTokenUsable } from '@/lib/token-policy';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; password?: string } | null;
  if (!body?.token || !body.password || !validatePassword(body.password)) return NextResponse.json({ error: 'Heslo musí mít alespoň 12 znaků a obsahovat písmeno i číslo.' }, { status: 400 });
  const record = await prisma.userToken.findUnique({ where: { tokenHash: hashToken(body.token) }, include: { user: true } });
  if (!record || !isTokenUsable(record) || (record.type === 'PASSWORD_RESET' && record.user.status !== 'ACTIVE') || (record.type === 'ACTIVATION' && record.user.status !== 'INVITED')) return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  const passwordHash = await hashPassword(body.password);
  const claimed = await prisma.$transaction(async (transaction) => {
    const claim = await transaction.userToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claim.count !== 1) return false;
    await transaction.user.update({ where: { id: record.userId }, data: { passwordHash, ...(record.type === 'ACTIVATION' ? { status: 'ACTIVE' } : {}), sessionVersion: { increment: 1 } } });
    await transaction.userSession.deleteMany({ where: { userId: record.userId } });
    return true;
  });
  if (!claimed) return NextResponse.json({ error: 'Odkaz je neplatný nebo již byl použit.' }, { status: 400 });
  await audit(record.type === 'ACTIVATION' ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_CHANGED', record.userId, record.userId);
  return NextResponse.json({ ok: true });
}
