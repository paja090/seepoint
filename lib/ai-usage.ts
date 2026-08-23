import { platformPrisma } from './db';
import type { AIFeatureType } from '@prisma/client';

export type LogAIUsageInput = {
  organizationId: string;
  userId?: string | null;
  feature: AIFeatureType;
  modelName?: string;
  promptTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  costEstimateUsd?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Log AI feature usage per organization for billing, quotas and usage analytics.
 */
export async function logAIUsage({
  organizationId,
  userId,
  feature,
  modelName = 'gemini-2.5-flash',
  promptTokens = 0,
  outputTokens = 0,
  imageCount = 0,
  costEstimateUsd = 0.001,
  metadata,
}: LogAIUsageInput) {
  try {
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
          costEstimateUsd,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } else {
      console.log('[AI Usage Log]', { organizationId, feature, costEstimateUsd, metadata });
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
