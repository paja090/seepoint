import { Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACTIVE_ROLE_COOKIE, getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Uživatel není přihlášen.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { role?: Role } | null;
  const requestedRole = body?.role;

  if (!requestedRole || !user.allowedRoles.includes(requestedRole)) {
    return NextResponse.json(
      { error: `Tuto roli nemáte přiřazenou. Dostupné role: ${user.allowedRoles.join(', ')}` },
      { status: 403 }
    );
  }

  const jar = await cookies();
  jar.set(ACTIVE_ROLE_COOKIE, requestedRole, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400, // 30 days
  });

  return NextResponse.json({
    ok: true,
    activeRole: requestedRole,
    allowedRoles: user.allowedRoles,
  });
}
