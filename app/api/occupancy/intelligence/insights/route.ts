import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { Prisma, OccupancyInsightStatus, OccupancyInsightType, OccupancyInsightSeverity } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const typeParam = searchParams.get('type');
  const severityParam = searchParams.get('severity');
  const cityParam = searchParams.get('city');
  const qParam = searchParams.get('q');

  const where: Prisma.OccupancyInsightWhereInput = {
    organizationId: user.organizationId,
  };

  if (statusParam && statusParam !== 'ALL') {
    where.status = statusParam as OccupancyInsightStatus;
  } else if (!statusParam) {
    where.status = { in: ['OPEN', 'REVIEWED'] };
  }

  if (typeParam && typeParam !== 'ALL') {
    where.type = typeParam as OccupancyInsightType;
  }

  if (severityParam && severityParam !== 'ALL') {
    where.severity = severityParam as OccupancyInsightSeverity;
  }

  if (cityParam) {
    where.carrier = { city: { contains: cityParam, mode: 'insensitive' } };
  }

  if (qParam?.trim()) {
    const q = qParam.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { deterministicReason: { contains: q, mode: 'insensitive' } },
      { surface: { name: { contains: q, mode: 'insensitive' } } },
      { carrier: { code: { contains: q, mode: 'insensitive' } } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [insights, totalCount, criticalCount, openCount] = await Promise.all([
    prisma.occupancyInsight.findMany({
      where,
      include: {
        surface: {
          select: {
            id: true,
            name: true,
            status: true,
            mediaType: true,
            price: true,
          },
        },
        carrier: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            region: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      take: 200,
    }),
    prisma.occupancyInsight.count({ where: { organizationId: user.organizationId } }),
    prisma.occupancyInsight.count({ where: { organizationId: user.organizationId, severity: 'CRITICAL', status: { in: ['OPEN', 'REVIEWED'] } } }),
    prisma.occupancyInsight.count({ where: { organizationId: user.organizationId, status: { in: ['OPEN', 'REVIEWED'] } } }),
  ]);

  return NextResponse.json({
    insights,
    metrics: {
      totalCount,
      criticalCount,
      openCount,
    },
  });
}
