import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import { canAccess, type AppSection } from './rbac';

export async function requireApiAccess(section: AppSection) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (!canAccess(user.role, section)) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return user;
}

export function isApiDenied(value: Awaited<ReturnType<typeof requireApiAccess>>): value is NextResponse<{ error: string }> {
  return value instanceof NextResponse;
}
