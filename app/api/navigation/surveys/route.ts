import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';

    const whereCondition: Prisma.NavigationOrderWhereInput = {};

    if (search.trim()) {
      whereCondition.OR = [
        { targetName: { contains: search, mode: 'insensitive' } },
        { targetAddress: { contains: search, mode: 'insensitive' } },
        { crmOrder: { client: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (filter === 'my') {
      whereCondition.OR = [
        { installerUserId: currentUser.id },
        { candidatePoints: { some: { createdByUserId: currentUser.id } } },
      ];
    } else if (filter === 'pendingReview') {
      whereCondition.candidatePoints = {
        some: { supervisionStatus: 'PENDING_REVIEW' },
      };
    } else if (filter === 'active') {
      whereCondition.status = { not: 'DOKONCENO' };
    }

    const orders = await prisma.navigationOrder.findMany({
      where: whereCondition,
      include: {
        crmOrder: {
          include: {
            client: {
              select: { id: true, name: true, tradingName: true },
            },
          },
        },
        installerUser: {
          select: { id: true, name: true, email: true },
        },
        surveyRoutes: {
          where: { active: true },
          orderBy: { routeOrder: 'asc' },
        },
        candidatePoints: {
          select: {
            id: true,
            supervisionStatus: true,
            surveyStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const formattedSurveys = orders.map((order) => {
      const totalCandidates = order.candidatePoints.length;
      const pendingReviewCount = order.candidatePoints.filter(
        (candidate) => candidate.supervisionStatus === 'PENDING_REVIEW'
      ).length;
      const approvedCount = order.candidatePoints.filter(
        (candidate) => candidate.supervisionStatus === 'APPROVED'
      ).length;
      const recheckCount = order.candidatePoints.filter(
        (candidate) => candidate.supervisionStatus === 'NEEDS_RECHECK'
      ).length;
      const rejectedCount = order.candidatePoints.filter(
        (candidate) => candidate.supervisionStatus === 'REJECTED'
      ).length;

      const lastSurveyAt = order.candidatePoints.reduce((latest, candidate) => {
        return candidate.createdAt > latest ? candidate.createdAt : latest;
      }, order.createdAt);

      return {
        id: order.id,
        crmOrderId: order.crmOrderId,
        orderTitle: `Zakázka Z-${order.crmOrderId.slice(-4).toUpperCase()} – ${order.targetName}`,
        clientName: order.crmOrder?.client?.name || 'Neznámý klient',
        targetName: order.targetName,
        targetAddress: order.targetAddress,
        targetLatitude: order.targetLatitude,
        targetLongitude: order.targetLongitude,
        status: order.status,
        blockStatus: order.blockStatus,
        installerUser: order.installerUser,
        routesCount: order.surveyRoutes.length,
        routes: order.surveyRoutes,
        metrics: {
          totalCandidates,
          pendingReviewCount,
          approvedCount,
          recheckCount,
          rejectedCount,
        },
        lastSurveyAt,
      };
    });

    return NextResponse.json({ surveys: formattedSurveys });
  } catch (error: unknown) {
    console.error('Error fetching navigation surveys:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba při načítání průzkumů.' },
      { status: 500 }
    );
  }
}
