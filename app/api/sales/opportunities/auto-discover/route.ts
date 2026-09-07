import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';
import { collectSignalsForProfile } from '@/lib/opportunities/feed-collector';
import { searchLiveOpportunitiesWithGemini } from '@/lib/opportunities/live-search';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Multi-Tenant Live Automated AI Discovery Job
 * 
 * Loads organization radar profile (or derives intelligent inventory defaults),
 * runs Gemini live Google Search Grounding for fresh regional opportunities,
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

  const body = await request.json().catch(() => ({}));
  const batchLimit = Math.min(Math.max(Number(body?.limit) || 15, 5), 25);
  const startTime = Date.now();
  const TIME_BUDGET_MS = 28_000; // 28s budget to safely return within Vercel execution window

  const run = await prisma.radarRun.create({
    data: {
      organizationId: user.organizationId,
      profileId: profile.id || null,
      triggerType: 'MANUAL',
      status: 'RUNNING',
    },
  });

  try {
    let addedCount = 0;
    let duplicateCount = 0;
    let ignoredCount = 0;
    let errorsCount = 0;
    let liveFoundCount = 0;

    // 1. Live Web Search Grounding via Gemini 3.6 Flash (real-time regional opportunities)
    try {
      const liveResults = await searchLiveOpportunitiesWithGemini(profile);
      liveFoundCount = liveResults.length;

      for (const item of liveResults) {
        try {
          // Persist signal to RadarSignal
          const signal = await prisma.radarSignal.upsert({
            where: {
              organizationId_sourceUrl: {
                organizationId: user.organizationId,
                sourceUrl: item.sourceUrl,
              },
            },
            create: {
              organizationId: user.organizationId,
              sourceUrl: item.sourceUrl,
              sourceTitle: item.sourceTitle,
              sourcePublishedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : new Date(),
              rawText: item.summary,
              status: 'NEW',
            },
            update: {},
          });

          const result = await createOpportunity({
            ...item,
            radarSignalId: signal.id,
          }, user.organizationId);

          if (result.created) {
            addedCount++;
            await prisma.radarSignal.updateMany({
              where: { id: signal.id, organizationId: user.organizationId },
              data: { status: 'PROCESSED', discoveredOpportunityId: result.opportunity?.id },
            }).catch(() => null);
          } else {
            duplicateCount++;
          }
        } catch (err) {
          errorsCount++;
          console.error('Failed processing live search opportunity', item.companyName, err);
        }
      }
    } catch (err) {
      console.error('Live search grounding error (continuing with RSS)', err);
    }

    // 2. Targeted RSS Feeds Discovery (collect signals into DB)
    const { rawFound, uniqueSignals } = await collectSignalsForProfile(profile, user.organizationId);

    // Prioritize unprocessed signals
    const unanalyzedSignals = uniqueSignals.filter(
      (s) => s.status === 'NEW' && !s.discoveredOpportunityId
    );
    const remainingSlots = Math.max(batchLimit - addedCount, 5);
    const signalsToProcess = unanalyzedSignals.slice(0, remainingSlots);

    // Only process additional RSS signals if time budget permits and more items needed
    if (addedCount < 8 && Date.now() - startTime < TIME_BUDGET_MS) {
      for (const signal of signalsToProcess) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log('Time budget reached, stopping RSS parsing early');
          break;
        }

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
            await prisma.radarSignal.updateMany({
              where: { id: signal.id, organizationId: user.organizationId },
              data: { status: 'PROCESSED', discoveredOpportunityId: result.opportunity?.id },
            }).catch(() => null);
          } else {
            duplicateCount++;
          }
        } catch (err) {
          errorsCount++;
          console.error('Failed processing RSS signal for opportunity', signal.sourceTitle, err);
          await prisma.radarSignal.updateMany({
            where: { id: signal.id, organizationId: user.organizationId },
            data: { status: 'FAILED' },
          }).catch(() => null);
        }
      }
    }

    const totalFound = rawFound + liveFoundCount;
    const totalProcessed = liveFoundCount + signalsToProcess.length;

    await prisma.radarRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        signalsFound: totalFound,
        signalsProcessed: totalProcessed,
        opportunitiesCreated: addedCount,
        duplicatesCount: duplicateCount,
        errorsCount,
        summaryLog: {
          liveFoundCount,
          rssProcessedCount: signalsToProcess.length,
          ignoredCount,
          targetCities: profile.targetCities,
          targetRegions: profile.targetRegions,
        },
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      foundArticles: totalFound,
      processed: totalProcessed,
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

