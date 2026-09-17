import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  try {
    const runs = await prisma.radarRun.findMany({
      where: { organizationId: user.organizationId, triggerType: { in: ['MANUAL', 'CRON'] } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const events = await prisma.radarRun.findMany({
      where: { organizationId: user.organizationId, triggerType: { in: ['SEMANTIC', 'SEMANTIC_MANUAL'] }, startedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { summaryLog: true }, orderBy: { startedAt: 'desc' }, take: 1000,
    });
    const totals: Record<string, number> = {};
    for (const event of events) {
      const log = event.summaryLog as { metrics?: Record<string, unknown> } | null;
      for (const [key, value] of Object.entries(log?.metrics || {})) if (typeof value === 'number' && Number.isFinite(value)) totals[key] = (totals[key] || 0) + value;
    }
    const semanticMetrics = { ...totals, averageConfidence: totals.confidenceCount ? totals.confidenceSum / totals.confidenceCount : null };
    return NextResponse.json({ runs, semanticMetrics, metricsWindowDays: 30, metricsSampleSize: events.length, metricsSampleLimit: 1000, metricsTruncated: events.length === 1000 });

  } catch (err) {
    console.error('Failed to get radar runs', err);
    return NextResponse.json({ error: 'Chyba při načítání historie běhů radaru.' }, { status: 500 });
  }
}
