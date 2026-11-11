import 'server-only';
import { prisma } from '@/lib/db';
import { createOpportunity } from '@/lib/opportunities/service';
import { parseOpportunityFromAiInput, type ParsedOpportunityResult } from '@/lib/opportunities/parser';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';
import { collectSignalsForProfile } from '@/lib/opportunities/feed-collector';
import { searchLiveOpportunitiesWithGemini } from '@/lib/opportunities/live-search';
import { logAIUsage } from '@/lib/ai-usage';
import { runWithTenantContext } from '@/lib/tenant-context';
import type { CreateOpportunityInput } from '@/lib/opportunities/types';

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

/** How many RSS articles are analysed by AI in parallel. */
const RSS_PARSE_CONCURRENCY = 5;

const POSITIVE_SIGNAL = /otev[řr]|otv[íi]r|nov[áaéýyou]\s+(prodejn|poboč|restaurac|kavárn|obchod|showroom|provozovn|centr|hal|areál)|poboč|prodejn|supermarket|hypermarket|retail|nákupn|obchodní (centrum|zón)|výstavb|stavb|developer|rezidenc|bytov|byt[yů]\b|autosalon|showroom|klinik|ordinac|lékárn|fitness|wellness|aquapark|festival|koncert|veletrh|výstav|jarmark|slavnost|expan|nábor|zaměstnan|investic|továrn|závod|sklad|logistick|rekonstrukc|znovu ?otev|stěhuj|přestěh|nov[ýá] majitel|franšíz|rebranding|kampaň/i;
const NEGATIVE_SIGNAL = /nehod|havári|zemřel|zemřela|úmrt|policie|policist|soud|obžal|vražd|zavražd|počasí|předpověď|požár|hasič|krádež|zloděj|zatkl|zadržel|pohřeš|tragédi|utonul|sráž/i;

/** Cheap keyword relevance so AI calls are spent on likely opportunities first. */
export function scoreSignalRelevance(text: string): number {
  const positive = (text.match(new RegExp(POSITIVE_SIGNAL.source, 'gi')) || []).length;
  const negative = NEGATIVE_SIGNAL.test(text);
  if (negative && positive === 0) return -1;
  return positive - (negative ? 1 : 0);
}

/** Serialises ingestion: every createOpportunity takes the same per-tenant transaction lock. */
function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
    return next;
  };
}

/**
 * Shared Discovery Runner for both Manual User Trigger and Automated CRON.
 * Fully multi-tenant isolated via runWithTenantContext.
 *
 * Live web search (slow, ~25 s) and RSS article analysis run concurrently so a slow
 * grounded search can no longer starve the RSS pipeline of its time budget.
 */
export async function runDiscoveryForOrganization(
  params: DiscoveryRunParams
): Promise<DiscoveryRunResult> {
  const { organizationId, userId, triggerType, batchLimit = 25, timeBudgetMs = 75_000 } = params;

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
      let rssProcessedCount = 0;
      let liveFailed = false;
      const warnings: string[] = [];
      const deadline = startTime + timeBudgetMs;
      const ingest = createSerialQueue();

      // Start RSS collection immediately; catch to avoid unhandled rejections.
      const rssPromise = collectSignalsForProfile(profile, organizationId).catch(() => ({ rawFound: 0, uniqueSignals: [], sourceErrors: 1, stage1DuplicateCount: 0 }));

      const ingestOne = async (input: CreateOpportunityInput & { radarSignalId: string }) => {
        const result = await ingest(async () => {
          if (Date.now() >= deadline - 2_000 || addedCount >= batchLimit) return null;
          const createdOrExisting = await createOpportunity(input, organizationId, deadline);
          if (createdOrExisting.created) {
            addedCount++;
          } else {
            duplicateCount++;
          }
          return createdOrExisting;
        });
        if (!result?.created) return;

        await prisma.radarSignal
          .updateMany({
            where: { id: input.radarSignalId, organizationId },
            data: { status: 'PROCESSED', discoveredOpportunityId: result.opportunity?.id },
          })
          .catch(() => null);
      };

      try {
        // Fetch already discovered opportunities so Live Search avoids returning the exact same headlines repeatedly
        const existingOpps = await prisma.salesOpportunity.findMany({
          where: { organizationId, mergedIntoId: null },
          select: { companyName: true, city: true, title: true },
          orderBy: { createdAt: 'desc' },
          take: 35,
        });
        const existingLeadSummaries = existingOpps.map((o) =>
          [o.companyName, o.city ? `(${o.city})` : '', '–', o.title].filter(Boolean).join(' ')
        );

        // 1. Live Web Search Grounding via Gemini (runs in parallel with RSS analysis)
        const livePhase = (async () => {
          try {
            const liveDeadline = deadline - 10_000;
            const liveResults = await searchLiveOpportunitiesWithGemini(profile, liveDeadline, existingLeadSummaries);
            const boundedLiveResults = liveResults.slice(0, batchLimit);
            liveFoundCount = boundedLiveResults.length;

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

            for (const item of boundedLiveResults) {
              try {
                const signal = await prisma.radarSignal.upsert({
                  where: { organizationId_sourceUrl: { organizationId, sourceUrl: item.sourceUrl } },
                  create: {
                    organizationId,
                    sourceUrl: item.sourceUrl,
                    sourceTitle: item.sourceTitle,
                    sourcePublishedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
                    rawText: item.summary,
                    status: 'NEW',
                  },
                  update: {},
                });
                await ingestOne({ ...item, radarSignalId: signal.id });
              } catch (err) {
                errorsCount++;
                console.error('Failed processing live search opportunity', item.companyName, err);
              }
            }
          } catch (err) {
            // Live search is a bonus source; RSS keeps working, so this is a warning, not a hard failure.
            liveFailed = true;
            warnings.push(err instanceof Error ? err.message : 'Živé AI hledání selhalo.');
            console.error('Live search grounding error in runner (continuing with RSS)', err);
          }
        })();

        // 2. RSS Feeds Discovery: collect, keyword-prioritise, analyse in parallel
        const rssPhase = (async () => {
          const { uniqueSignals, sourceErrors } = await rssPromise;
          if (sourceErrors) warnings.push(`Nepodařilo se načíst ${sourceErrors} RSS zdrojů.`);

          const scored = uniqueSignals
            .filter((s) => s.status === 'NEW' && !s.discoveredOpportunityId)
            .map((s) => ({ signal: s, relevance: scoreSignalRelevance([s.sourceTitle, s.rawText].filter(Boolean).join(' ')) }));

          // Clearly irrelevant news (accidents, crime, weather) is closed without spending AI.
          const rejected = scored.filter((s) => s.relevance < 0);
          if (rejected.length) {
            ignoredCount += rejected.length;
            await prisma.radarSignal
              .updateMany({
                where: { organizationId, id: { in: rejected.map((r) => r.signal.id) } },
                data: { status: 'IGNORED' },
              })
              .catch(() => null);
          }

          const queue = scored
            .filter((s) => s.relevance >= 0)
            .sort((a, b) =>
              b.relevance - a.relevance ||
              (b.signal.sourcePublishedAt?.getTime() || 0) - (a.signal.sourcePublishedAt?.getTime() || 0)
            )
            .slice(0, Math.min(batchLimit, 20))
            .map((s) => s.signal);

          const worker = async () => {
            while (queue.length) {
              if (Date.now() >= deadline - 8_000 || addedCount >= batchLimit) return;
              const signal = queue.shift();
              if (!signal) return;
              rssProcessedCount++;
              try {
                const signalInputText = [signal.sourceTitle, signal.rawText].filter(Boolean).join('\n\n');
                const parsed: ParsedOpportunityResult = await parseOpportunityFromAiInput(
                  signalInputText,
                  signal.sourceUrl,
                  profile,
                  deadline - 3_000
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

                await ingestOne({
                  ...parsed,
                  sourceUrl: signal.sourceUrl,
                  sourceTitle: signal.sourceTitle,
                  sourcePublishedAt: signal.sourcePublishedAt || undefined,
                  radarSignalId: signal.id,
                });
              } catch (err) {
                errorsCount++;
                console.error('Failed processing RSS signal for opportunity', signal.sourceTitle, err);
                await prisma.radarSignal
                  .updateMany({ where: { id: signal.id, organizationId }, data: { status: 'FAILED' } })
                  .catch(() => null);
              }
            }
          };

          await Promise.all(Array.from({ length: RSS_PARSE_CONCURRENCY }, worker));
        })();

        await Promise.all([livePhase, rssPhase]);
        const { rawFound, stage1DuplicateCount } = await rssPromise;

        const totalFound = rawFound + liveFoundCount;
        const totalProcessed = liveFoundCount + rssProcessedCount;

        const success = addedCount + duplicateCount + ignoredCount > 0 || (errorsCount === 0 && !liveFailed);
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
            errorsCount: errorsCount + (liveFailed ? 1 : 0),
            summaryLog: {
              warnings,
              liveFoundCount,
              liveFailed,
              rssProcessedCount,
              ignoredCount,
              rssStage1Duplicates: stage1DuplicateCount,
              triggerType,
              durationMs: Date.now() - startTime,
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
          errorsCount: errorsCount + (liveFailed ? 1 : 0),
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
