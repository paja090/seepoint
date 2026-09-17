import { plannerActor } from '@/lib/planner/auth';
import { finishCalendarOAuth, oauthResult } from '@/lib/planner/oauth';
import { runWithTenantContext } from '@/lib/tenant-context';
export async function GET(request: Request) {
  try {
    const actor = await plannerActor();
    await runWithTenantContext({ organizationId: actor.organizationId, userId: actor.id, source: 'session' }, () => finishCalendarOAuth(actor, request));
    return oauthResult(request, 'connected');
  } catch { return oauthResult(request, 'error'); }
}
