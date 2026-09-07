import { platformPrisma } from './db';

export type AIFeatureType = 'OFFER_GENERATOR' | 'SALES_RADAR' | 'PHOTO_ANALYSIS' | 'ASSISTANT';

export type LogAIUsageInput = {
  organizationId: string;
  userId?: string | null;
  feature: AIFeatureType;
  modelName?: string;
  promptTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  hasSearchGrounding?: boolean;
  costEstimateUsd?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Official Gemini 3.6 Flash pricing structure (Google AI Studio / Cloud rates):
 * - Text prompt input: $0.10 per 1,000,000 tokens ($0.0001 / 1k tokens)
 * - Text output: $0.40 per 1,000,000 tokens ($0.0004 / 1k tokens)
 * - Image input: ~258 tokens per image
 * - Web search grounding tool: baseline estimate ~$0.0025 per grounded query
 */
export function estimateGeminiFlashCostUsd({
  promptTokens = 0,
  outputTokens = 0,
  imageCount = 0,
  hasSearchGrounding = false,
}: {
  promptTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  hasSearchGrounding?: boolean;
}): number {
  const imageTokens = imageCount * 258;
  const tokenCost = ((promptTokens + imageTokens) * 0.0000001) + (outputTokens * 0.0000004);
  const groundingCost = hasSearchGrounding ? 0.0025 : 0;
  return Number((tokenCost + groundingCost).toFixed(6));
}

/**
 * Log AI feature usage per organization for billing, quotas and usage analytics.
 */
export async function logAIUsage({
  organizationId,
  userId,
  feature,
  modelName = 'gemini-3.6-flash',
  promptTokens = 0,
  outputTokens = 0,
  imageCount = 0,
  hasSearchGrounding = false,
  costEstimateUsd,
  metadata,
}: LogAIUsageInput) {
  try {
    const effectiveCostUsd = typeof costEstimateUsd === 'number' && costEstimateUsd >= 0
      ? costEstimateUsd
      : estimateGeminiFlashCostUsd({ promptTokens, outputTokens, imageCount, hasSearchGrounding });

    const db = platformPrisma as unknown as {
      aIUsageLog?: {
        create: (args: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };

    if (db.aIUsageLog) {
      await db.aIUsageLog.create({
        data: {
          organizationId,
          userId: userId ?? null,
          feature,
          modelName,
          promptTokens,
          outputTokens,
          imageCount,
          costEstimateUsd: effectiveCostUsd,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } else {
      console.log('[AI Usage Log]', { organizationId, feature, costEstimateUsd: effectiveCostUsd, metadata });
    }
  } catch (err) {
    console.warn('[AI Usage Log Error] Failed to write usage log:', err);
  }
}

/**
 * Get monthly AI usage stats for an organization
 */
export async function getOrganizationAIUsage(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    const db = platformPrisma as unknown as {
      aIUsageLog?: {
        aggregate: (args: Record<string, unknown>) => Promise<{
          _count: { _all: number };
          _sum: { costEstimateUsd: number | null; promptTokens: number | null; outputTokens: number | null };
        }>;
      };
    };

    if (!db.aIUsageLog) {
      return { totalCalls: 0, totalCostUsd: 0, startOfMonth };
    }

    const stats = await db.aIUsageLog.aggregate({
      where: {
        organizationId,
        createdAt: { gte: startOfMonth },
      },
      _count: { _all: true },
      _sum: { costEstimateUsd: true, promptTokens: true, outputTokens: true },
    });

    return {
      totalCalls: stats._count._all || 0,
      totalCostUsd: stats._sum.costEstimateUsd || 0,
      totalPromptTokens: stats._sum.promptTokens || 0,
      totalOutputTokens: stats._sum.outputTokens || 0,
      startOfMonth,
    };
  } catch (err) {
    console.warn('[AI Usage Stats Error]:', err);
    return { totalCalls: 0, totalCostUsd: 0, startOfMonth };
  }
}
