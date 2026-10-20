import { runWithTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { postponeFieldPlan } from '@/lib/election-removal/postpone-plan';
export async function POST(request: Request) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  try {
    const body = await request.json();
    return NextResponse.json(await runWithTenantContext({organizationId:auth.organizationId,userId:auth.user.id,source:'session'},()=>postponeFieldPlan(body.planId, auth.user)));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Přesun trasy selhal.' }, { status: 409 }); }
}
