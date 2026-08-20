import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, my, active, pendingReview, completed

    const whereCondition: any = {};

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
      whereCondition.status = { notIn: ['DOKONCENO', 'STORNO'] };
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
        (c) => c.supervisionStatus === 'PENDING_REVIEW'
      ).length;
      const approvedCount = order.candidatePoints.filter(
        (c) => c.supervisionStatus === 'APPROVED'
      ).length;
      const recheckCount = order.candidatePoints.filter(
        (c) => c.supervisionStatus === 'NEEDS_RECHECK'
      ).length;
      const rejectedCount = order.candidatePoints.filter(
        (c) => c.supervisionStatus === 'REJECTED'
      ).length;

      const lastSurveyAt = order.candidatePoints.reduce((latest, c) => {
        return c.createdAt > latest ? c.createdAt : latest;
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
  } catch (error: any) {
    console.error('Error fetching navigation surveys:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při načítání průzkumů.' },
      { status: 500 }
    );
  }
}
