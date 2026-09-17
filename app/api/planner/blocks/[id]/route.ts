import { plannerApi } from '@/lib/planner/auth';
import { changeBlock } from '@/lib/planner/blocks';
type Context = { params: Promise<{ id: string }> };
export function PATCH(request: Request, context: Context) { return plannerApi(request, async actor => changeBlock(actor, (await context.params).id, await request.json())); }
export function DELETE(request: Request, context: Context) { return plannerApi(request, async actor => changeBlock(actor, (await context.params).id, await request.json(), true)); }
