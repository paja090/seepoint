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
 * Flow:
 * 1. Discovery/Import (from RSS/Web Signals/APIs)
 * 2. Normalization
 * 3. Deduplication check
 * 4. Opportunity Scoring
 * 5. Saves in status 'NEW' for Human Approval
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Import radaru může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
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
