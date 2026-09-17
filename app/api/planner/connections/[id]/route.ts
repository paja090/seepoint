import { plannerApi } from '@/lib/planner/auth';
import { disconnectConnection } from '@/lib/planner/connections';
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return plannerApi(request, async actor => disconnectConnection(actor.organizationId, actor.id, (await context.params).id)); }
