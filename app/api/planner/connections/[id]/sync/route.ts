import { prisma } from '@/lib/db';
import { plannerApi } from '@/lib/planner/auth';
import { assertCalendarEnabled } from '@/lib/planner/connections';
import { syncConnection } from '@/lib/planner/sync';
import { assertOwner } from '@/lib/planner/permissions';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
export const maxDuration = 240;
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return plannerApi(request, async actor => {
  assertCalendarEnabled(actor);
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${actor.organizationId}:${actor.id}`), { scope: 'planner:sync', windowMs: 60000, limits: { ip: 60, identity: 4, pair: 4 } });
  if (limited) return limited;
  const { id } = await context.params;
  const connection = await prisma.calendarConnection.findFirst({ where: { id, organizationId: actor.organizationId }, select: { organizationId: true, userId: true } });
  assertOwner(actor, connection);
  return syncConnection(actor.organizationId, actor.id, id);
}); }
