import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getCurrentUser } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/organization-modules';
import { canAccess } from '@/lib/rbac';
import { redirect } from 'next/navigation';

export async function requireElectionRemovalAccess(manage = false) {
  const user = await requireApiAccess('electionRemoval');
  if (isApiDenied(user)) return user;
  if (manage && !['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Plánování a změna zadání vyžadují správce nebo manažera.' }, { status: 403 });

  const organizationId = user.organizationId!;
  enterTenantContext({ organizationId, userId: user.id, source: 'session' });
  return { user, organizationId };
}

export function isElectionRemovalAccessDenied(
  result: Awaited<ReturnType<typeof requireElectionRemovalAccess>>
): result is NextResponse<{ error: string }> {
  return result instanceof NextResponse;
}

export async function checkElectionRemovalPageAccess() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.organization || !isModuleEnabled(user.organization, 'electionRemoval')) {
    redirect('/dashboard');
  }
  if (!canAccess(user.role, 'electionRemoval')) {
    redirect('/dashboard');
  }
  enterTenantContext({ organizationId: user.organization.id, userId: user.id, source: 'session' });
  return user;
}
