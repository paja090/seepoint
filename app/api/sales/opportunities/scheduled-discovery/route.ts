import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { OpportunityValidationError, parseOpportunityCreateInput } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

/**
 * Scheduled Discovery Job Framework Endpoint
 * 
 * Supports two modes:
 * 1. Automated CRON mode (mode === 'cron'): Discovers signals via profile, parses via AI, creates opportunities.
 * 2. Managed Batch Import (body.signals): Normalizes, deduplicates, scores, and saves passed signals.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Import radaru může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const isCron = url.searchParams.get('mode') === 'cron' || body.mode === 'cron';

    if (isCron) {
      const { runDiscoveryForOrganization } = await import('@/lib/opportunities/discovery-runner');
      return NextResponse.json(await runDiscoveryForOrganization({ organizationId: user.organizationId, userId: user.id, triggerType: 'CRON' }));
    }

    const rawSignals = Array.isArray(body.signals) ? body.signals.slice(0, 25) : [];
    if (!rawSignals.length) return NextResponse.json({ error: 'Chybí signály k importu.' }, { status: 400 });
    if (Array.isArray(body.signals) && body.signals.length > 25) return NextResponse.json({ error: 'V jednom importu lze zpracovat nejvýše 25 signálů.' }, { status: 413 });

    let importedCount = 0;
    let duplicateCount = 0;

    for (const signal of rawSignals) {
      const input = parseOpportunityCreateInput({ ...signal, summary: signal.summary || signal.title, sourceTitle: signal.sourceTitle || 'Řízený radarový import' });
      const result = await createOpportunity(input, user.organizationId);

      if (result.created) {
        importedCount++;
      } else {
        duplicateCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      duplicateCount,
      totalProcessed: rawSignals.length,
    });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Scheduled discovery import error', error);
    return NextResponse.json({ error: 'Import příležitostí selhal.' }, { status: 500 });
  }
}
