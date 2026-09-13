import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { executeInsightAction } from '@/lib/occupancy/intelligence-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const insightId = body.insightId;
    const action = body.action || body.actionType;

    if (!insightId || !action) {
      return NextResponse.json({ error: 'Chybí povinné parametry insightId nebo action.' }, { status: 400 });
    }

    const result = await executeInsightAction(
      user.organizationId,
      insightId,
      action,
      user
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Occupancy Intelligence Resolve Error]:', error);
    return NextResponse.json(
      { error: 'Provedení akce selhalo.', details: error instanceof Error ? error.message : 'Neznámá chyba' },
      { status: 500 }
    );
  }
}
