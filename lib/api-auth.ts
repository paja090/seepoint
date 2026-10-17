import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import { canAccess, type AppSection } from './rbac';
import { hasModuleAccess, moduleForSection } from './module-policy';

export async function requireApiAccess(section: AppSection | AppSection[], moduleId?: string | null) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  const sections = Array.isArray(section) ? section : [section];
  const matchedSection = sections.find((s) => canAccess(user.role, s));
  if (!matchedSection) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (moduleId === undefined) {
    moduleId = moduleForSection(matchedSection);
  }
  if (moduleId && !hasModuleAccess(user, moduleId)) {
    return NextResponse.json({ error: 'Modul není dostupný.' }, { status: 403 });
  }
  return user;
}

export function isApiDenied(value: Awaited<ReturnType<typeof requireApiAccess>>): value is NextResponse<{ error: string }> {
  return value instanceof NextResponse;
}
