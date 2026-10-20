import { NextResponse } from 'next/server';
import { enterTenantContext } from '@/lib/tenant-context';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { plannerTransaction } from '@/lib/field-planning/service';
import { releaseFieldWork } from '@/lib/election-removal/release-work';
export async function POST(request: Request) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try {
    const input = await request.json();
    return NextResponse.json(await plannerTransaction(tx => releaseFieldWork(tx, input, auth.user)));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Uvolnění práce selhalo.' }, { status: 409 }); }
}
