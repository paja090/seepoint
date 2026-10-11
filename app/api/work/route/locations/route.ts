import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { requirePlannerManager } from '@/lib/field-planning/service';
import { loadPlanCrewLocations } from '@/lib/field-planning/live-location';

export async function GET(request: Request) {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });

  try {
    requirePlannerManager(user);
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    if (!planId) {
      return NextResponse.json({ error: 'Chybí parametr planId.' }, { status: 400 });
    }

    const locations = await loadPlanCrewLocations(planId, user.organizationId!);
    return NextResponse.json({ locations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Načtení poloh selhalo.';
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('FORBIDDEN') ? 403 : 500 }
    );
  }
}
