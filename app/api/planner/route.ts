import { plannerApi } from '@/lib/planner/auth';
import { readPlanner } from '@/lib/planner/read-model';
import { dateInZone } from '@/lib/planner/time';
import { preferencesFor } from '@/lib/planner/repository';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return plannerApi(request, async actor => {
    const q = new URL(request.url).searchParams;
    const preferences = await preferencesFor(actor.organizationId, actor.id, actor.organization?.plannerDefaults);
    return readPlanner(actor, q.get('date') || dateInZone(new Date(), preferences.timezone), q.get('view') || 'today');
  });
}
