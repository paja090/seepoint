import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
export async function PATCH() {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  return NextResponse.json({ error: 'Změňte posádku revizí konkrétního výjezdu na detailu akce. Zahájená přeprava vyžaduje předání materiálu.' }, { status: 409 });
}
