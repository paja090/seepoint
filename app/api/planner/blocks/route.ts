import { plannerApi } from '@/lib/planner/auth';
import { createBlock } from '@/lib/planner/blocks';
export function POST(request: Request) { return plannerApi(request, async actor => createBlock(actor, await request.json())); }
