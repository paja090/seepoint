import 'server-only';
import { prisma } from '@/lib/db';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';
import { collectSignalsForProfile } from '@/lib/opportunities/feed-collector';
import { searchLiveOpportunitiesWithGemini } from '@/lib/opportunities/live-search';
import { logAIUsage } from '@/lib/ai-usage';
import { runWithTenantContext } from '@/lib/tenant-context';

export type DiscoveryRunParams = {
  organizationId: string;
  userId?: string;
  triggerType: 'MANUAL' | 'CRON';
  batchLimit?: number;
  timeBudgetMs?: number;
};

export type DiscoveryRunResult = {
  success: boolean;
  disabled?: boolean;
  runId?: string;
  totalFound: number;
  processed: number;
  addedCount: number;
  duplicateCount: number;
  ignoredCount: number;
  errorsCount: number;
  error?: string;
};

/**
 * Shared Discovery Runner for both Manual User Trigger and Automated CRON.
 * Fully multi-tenant isolated via runWithTenantContext.
 */
export async function runDiscoveryForOrganization(
  params: DiscoveryRunParams
): Promise<DiscoveryRunResult> {
  const { organizationId, userId, triggerType, batchLimit = 15, timeBudgetMs = 25_000 } = params;

  return runWithTenantContext(
    {
      organizationId,
      userId: userId || 'cron-scheduler',
      source: 'session',
    },
    async () => {
      const profile = await getOrganizationRadarProfile(organizationId);
      if (!profile.enabled) {
        return {
          success: false,
          disabled: true,
          totalFound: 0,
          processed: 0,
          addedCount: 0,
          duplicateCount: 0,
          ignoredCount: 0,
          errorsCount: 0,
          error: 'AI Obchodní radar je pro tuto organizaci vypnutý v nastavení profilu.',
        };
      }

      const startTime = Date.now();
      const run = await prisma.radarRun.create({
        data: {
          organizationId,
          profileId: profile.id || null,
          triggerType,
          status: 'RUNNING',
        },
      });

      let addedCount = 0;
      let duplicateCount = 0;
      let ignoredCount = 0;
      let errorsCount = 0;
      let liveFoundCount = 0;
      const warnings: string[] = [];
      const deadline = startTime + timeBudgetMs;
      // Start RSS collection while web grounding runs; catch immediately to avoid unhandled rejections.
      const rssPromise = collectSignalsForProfile(profile, organizationId).catch(() => ({ rawFound: 0, uniqueSignals: [], sourceErrors: 1 }));

      try {
        // 1. Live Web Search Grounding via Gemini 3.6 Flash (real-time regional opportunities)
        try {
          const liveResults = await searchLiveOpportunitiesWithGemini(profile, startTime + Math.floor(timeBudgetMs * 0.6));
          const boundedLiveResults = liveResults.slice(0, batchLimit);
          liveFoundCount = boundedLiveResults.length;

          for (const item of boundedLiveResults) {
            try {
              const signal = await prisma.radarSignal.upsert({
                where: {
                  organizationId_sourceUrl: {
                    organizationId,
                    sourceUrl: item.sourceUrl,
                  },
                },
                create: {
                  organizationId,
                  sourceUrl: item.sourceUrl,
                  sourceTitle: item.sourceTitle,
                  sourcePublishedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : new Date(),
                  rawText: item.summary,
                  status: 'NEW',
                },
                update: {},
              });

              const result = await createOpportunity(
                {
                  ...item,
                  radarSignalId: signal.id,
                },
                organizationId
              );

              if (result.created) {
                addedCount++;
                await prisma.radarSignal
                  .updateMany({
                    where: { id: signal.id, organizationId },
                    data: { status: 'PROCESSED', discoveredOpportunityId: result.opportunity?.id },
                  })
                  .catch(() => null);
              } else {
                duplicateCount++;
              }
            } catch (err) {
              errorsCount++;
              console.error('Failed processing live search opportunity', item.companyName, err);
            }
          }

          if (liveFoundCount > 0) {
            await logAIUsage({
              organizationId,
              userId: triggerType === 'CRON' ? null : userId,
              feature: 'SALES_RADAR',
              modelName: 'gemini-3.6-flash',
              promptTokens: 1200,
              outputTokens: Math.max(liveFoundCount * 200, 300),
              costEstimateUsd: 0.003,
              metadata: { usageEstimated: true, costEstimated: true, action: 'live-search-grounding', triggerType, foundCount: liveFoundCount },
            });
          }
        } catch (err) {
          errorsCount++;
          warnings.push(err instanceof Error ? err.message : 'Živé AI hledání selhalo.');
          console.error('Live search grounding error in runner (continuing with RSS)', err);
        }

        // 2. Targeted RSS Feeds Discovery (collect signals into DB)
        const { rawFound, uniqueSignals, sourceErrors } = await rssPromise;
        errorsCount += sourceErrors;
        if (sourceErrors) warnings.push(`Nepodařilo se načíst ${sourceErrors} RSS zdrojů.`);

        const unanalyzedSignals = uniqueSignals.filter(
          (s) => s.status === 'NEW' && !s.discoveredOpportunityId
        );
        const remainingSlots = Math.max(batchLimit - addedCount, 0);
        const signalsToProcess = unanalyzedSignals.slice(0, remainingSlots);

        const shouldProcessRssAi =
          liveFoundCount < 3 && addedCount + duplicateCount < 3 && Date.now() - startTime < timeBudgetMs;
        let rssProcessedCount = 0;

        if (shouldProcessRssAi) {
          for (const signal of signalsToProcess.slice(0, 2)) {
            if (Date.now() - startTime > timeBudgetMs) {
              console.log('Time budget reached in runner, stopping RSS parsing early');
              break;
            }

            rssProcessedCount++;
            try {
              const parsed = await parseOpportunityFromAiInput(
                signal.sourceTitle,
                signal.sourceUrl,
                profile,
                deadline
              );

              await logAIUsage({
                organizationId,
                userId: triggerType === 'CRON' ? null : userId,
                feature: 'SALES_RADAR',
                modelName: 'gemini-3.6-flash',
                promptTokens: 800,
                outputTokens: 250,
                costEstimateUsd: 0.001,
                metadata: { usageEstimated: true, costEstimated: true, action: 'rss-parse', triggerType, signalId: signal.id },
              });

              if (!parsed.isRelevant) {
                ignoredCount++;
                await prisma.radarSignal.updateMany({
                  where: { id: signal.id, organizationId },
                  data: { status: 'IGNORED', parsedData: parsed as unknown as object },
                });
                continue;
              }

              const result = await createOpportunity(
                {
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
                },
                organizationId
              );

              if (result.created) {
                addedCount++;
                await prisma.radarSignal
                  .updateMany({
                    where: { id: signal.id, organizationId },
                    data: { status: 'PROCESSED', discoveredOpportunityId: result.opportunity?.id },
                  })
                  .catch(() => null);
              } else {
                duplicateCount++;
              }
            } catch (err) {
              errorsCount++;
              console.error('Failed processing RSS signal for opportunity', signal.sourceTitle, err);
              await prisma.radarSignal
                .updateMany({
                  where: { id: signal.id, organizationId },
                  data: { status: 'FAILED' },
                })
                .catch(() => null);
            }
          }
        }

        const totalFound = rawFound + liveFoundCount;
        const totalProcessed = liveFoundCount + rssProcessedCount;

        const success = errorsCount === 0 || addedCount + duplicateCount + ignoredCount > 0;
        if (errorsCount && !warnings.length) warnings.push('Některé signály se nepodařilo zpracovat.');
        await prisma.radarRun.update({
          where: { id: run.id },
          data: {
            status: success ? 'COMPLETED' : 'FAILED',
            finishedAt: new Date(),
            signalsFound: totalFound,
            signalsProcessed: totalProcessed,
            opportunitiesCreated: addedCount,
            duplicatesCount: duplicateCount,
            errorsCount,
            summaryLog: {
              warnings,
              liveFoundCount,
              rssProcessedCount,
              ignoredCount,
              triggerType,
              targetCities: profile.targetCities,
              targetRegions: profile.targetRegions,
            },
          },
        });

        return {
          success,
          error: warnings.join(' ') || undefined,
          runId: run.id,
          totalFound,
          processed: totalProcessed,
          addedCount,
          duplicateCount,
          ignoredCount,
          errorsCount,
        };
      } catch (error) {
        console.error('Discovery runner error', error);
        await prisma.radarRun
          .update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              finishedAt: new Date(),
              summaryLog: { error: error instanceof Error ? error.message : 'Unknown error' },
            },
          })
          .catch(() => null);

        return {
          success: false,
          runId: run.id,
          totalFound: 0,
          processed: 0,
          addedCount,
          duplicateCount,
          ignoredCount,
          errorsCount: errorsCount + 1,
          error: error instanceof Error ? error.message : 'Chyba při vyhledávání příležitostí.',
        };
      }
    }
  );
}
