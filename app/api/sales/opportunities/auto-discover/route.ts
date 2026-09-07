import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { runWithTenantContext } from '@/lib/tenant-context';
import { runDiscoveryForOrganization } from '@/lib/opportunities/discovery-runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manual Trigger for AI Discovery Job
 * 
 * Enforces permissions and rate limits, then executes the shared multi-tenant
 * discovery runner under tenant context.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Automatické hledání může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const limited = await enforceRateLimit(
    request,
    hashRateLimitIdentity(`${user.organizationId}:${user.id}`),
    rateLimitPolicies.opportunityDiscovery
  );
  if (limited) return limited;

  return runWithTenantContext(
    {
      organizationId: user.organizationId,
      userId: user.id,
      source: 'session',
    },
    async () => {
      const body = await request.json().catch(() => ({}));
      const batchLimit = Math.min(Math.max(Number(body?.limit) || 15, 5), 25);

      // Discovery runner processes signals bounded by remaining slots: .slice(0, remainingSlots)
      const result = await runDiscoveryForOrganization({
        organizationId: user.organizationId,
        userId: user.id,
        triggerType: 'MANUAL',
        batchLimit,
        timeBudgetMs: 20_000,
      });

      if (result.disabled) {
        return NextResponse.json(
          { error: result.error || 'AI Obchodní radar je pro vaši organizaci vypnutý v nastavení profilu.' },
          { status: 400 }
        );
      }

      if (!result.success && result.errorsCount > 0 && result.addedCount === 0) {
        return NextResponse.json(
          { error: result.error || 'Automatické vyhledávání selhalo.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        runId: result.runId,
        foundArticles: result.totalFound,
        processed: result.processed,
        addedCount: result.addedCount,
        duplicateCount: result.duplicateCount,
        ignoredCount: result.ignoredCount,
        errorsCount: result.errorsCount,
      });
    }
  );
}
