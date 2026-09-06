import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';
import { collectSignalsForProfile } from '@/lib/opportunities/feed-collector';
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
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Import radaru může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const isCron = url.searchParams.get('mode') === 'cron' || body.mode === 'cron';

    if (isCron) {
      const profile = await getOrganizationRadarProfile(user.organizationId);
      if (!profile.enabled) {
        return NextResponse.json({ ok: true, message: 'Radar je pro tuto organizaci pozastaven.' });
      }

      const run = await prisma.radarRun.create({
        data: {
          organizationId: user.organizationId,
          profileId: profile.id || null,
          triggerType: 'CRON',
          status: 'RUNNING',
        },
      });

      const { rawFound, uniqueSignals } = await collectSignalsForProfile(profile, user.organizationId);
      let importedCount = 0;
      let duplicateCount = 0;
      let ignoredCount = 0;

      for (const signal of uniqueSignals.slice(0, 5)) {
        try {
          const parsed = await parseOpportunityFromAiInput(signal.sourceTitle, signal.sourceUrl, profile);
          if (!parsed.isRelevant) {
            ignoredCount++;
            await prisma.radarSignal.updateMany({
              where: { id: signal.id, organizationId: user.organizationId },
              data: { status: 'IGNORED' },
            });
            continue;
          }

          const result = await createOpportunity({
            ...parsed,
            radarSignalId: signal.id,
          }, user.organizationId);

          if (result.created) importedCount++;
          else duplicateCount++;
        } catch {
          // ignore single signal failure
        }
      }

      await prisma.radarRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          signalsFound: rawFound,
          signalsProcessed: Math.min(5, uniqueSignals.length),
          opportunitiesCreated: importedCount,
          duplicatesCount: duplicateCount,
        },
      });

      return NextResponse.json({
        success: true,
        mode: 'cron',
        runId: run.id,
        importedCount,
        duplicateCount,
        ignoredCount,
      });
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
