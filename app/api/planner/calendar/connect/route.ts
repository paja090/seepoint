import { plannerApi } from '@/lib/planner/auth';
import { startCalendarOAuth } from '@/lib/planner/oauth';
export function POST(request: Request) { return plannerApi(request, actor => startCalendarOAuth(actor, request)); }
