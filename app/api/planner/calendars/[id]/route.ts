import { plannerApi } from '@/lib/planner/auth';
import { updateCalendar } from '@/lib/planner/connections';
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return plannerApi(request, async actor => updateCalendar(actor, (await context.params).id, await request.json())); }
