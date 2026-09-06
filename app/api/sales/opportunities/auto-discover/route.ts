import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';
import { collectSignalsForProfile } from '@/lib/opportunities/feed-collector';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Multi-Tenant Live Automated AI Discovery Job
 * 
 * Loads organization radar profile (or derives intelligent inventory defaults),
 * collects targeted RSS signals, persists into RadarSignal, parses via tenant-aware AI,
 * calculates geospatial & network scoring, and logs into RadarRun.
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Automatické hledání může spustit pouze administrátor nebo manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;

  const profile = await getOrganizationRadarProfile(user.organizationId);
  if (!profile.enabled) {
    return NextResponse.json({ error: 'AI Obchodní radar je pro vaši organizaci vypnutý v nastavení profilu.' }, { status: 400 });
  }

  const run = await prisma.radarRun.create({
    data: {
      organizationId: user.organizationId,
      profileId: profile.id || null,
      triggerType: 'MANUAL',
      status: 'RUNNING',
    },
  });

  try {
    const { rawFound, uniqueSignals } = await collectSignalsForProfile(profile, user.organizationId);

    let addedCount = 0;
    let duplicateCount = 0;
    let ignoredCount = 0;
    let errorsCount = 0;

    const signalsToProcess = uniqueSignals.slice(0, 5);

    for (const signal of signalsToProcess) {
      try {
        const parsed = await parseOpportunityFromAiInput(
          signal.sourceTitle,
          signal.sourceUrl,
          profile
        );

        if (!parsed.isRelevant) {
          ignoredCount++;
          await prisma.radarSignal.updateMany({
            where: { id: signal.id, organizationId: user.organizationId },
            data: { status: 'IGNORED', parsedData: parsed as unknown as object },
          });
          continue;
        }

        const result = await createOpportunity({
          companyName: parsed.companyName,
          companyId: parsed.companyId,
          website: parsed.website,
          eventType: parsed.eventType,
          title: parsed.title,
          summary: parsed.summary,
          city: parsed.city,
          region: parsed.region,
          address: parsed.address,
          eventDate: parsed.eventDate,
          sourceUrl: signal.sourceUrl,
          sourceTitle: signal.sourceTitle,
          sourcePublishedAt: signal.sourcePublishedAt || new Date(),
          suggestedMediaTypes: parsed.suggestedMediaTypes,
          radarSignalId: signal.id,
        }, user.organizationId);

        if (result.created) {
          addedCount++;
        } else {
          duplicateCount++;
        }
      } catch (err) {
        errorsCount++;
        console.error('Failed processing signal for opportunity', signal.sourceTitle, err);
        await prisma.radarSignal.updateMany({
          where: { id: signal.id, organizationId: user.organizationId },
          data: { status: 'FAILED' },
        }).catch(() => null);
      }
    }

    await prisma.radarRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        signalsFound: rawFound,
        signalsProcessed: signalsToProcess.length,
        opportunitiesCreated: addedCount,
        duplicatesCount: duplicateCount,
        errorsCount,
        summaryLog: {
          ignoredCount,
          targetCities: profile.targetCities,
          targetRegions: profile.targetRegions,
        },
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      foundArticles: rawFound,
      processed: signalsToProcess.length,
      addedCount,
      duplicateCount,
      ignoredCount,
      errorsCount,
    });
  } catch (error) {
    console.error('AI Auto Discovery error', error);
    await prisma.radarRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        summaryLog: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    }).catch(() => null);

    return NextResponse.json({ error: 'Automatické vyhledávání selhalo.' }, { status: 500 });
  }
}
