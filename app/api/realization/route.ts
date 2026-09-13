import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import { buildRealizationContext } from '@/lib/ai-realization/realization-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;

  try {
    const organizationId = auth.organizationId!;
    const profile = await getOrganizationRealizationProfile(organizationId);

    // Fetch active CRM orders
    const orders = await prisma.crmOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['CANCELLED'] },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const contexts = (
      await Promise.all(
        orders.map((o) => buildRealizationContext(o.id, auth, profile))
      )
    ).filter(Boolean);

    // Aggregate KPI metrics
    let totalActive = 0;
    let atRiskCount = 0;
    let blockedCount = 0;
    let missingPhotosCount = 0;
    let readyForBillingCount = 0;

    const items = contexts.map((ctx) => {
      const isCompleted = ctx!.status === 'COMPLETED' || ctx!.overallPhase === 'COMPLETED';
      if (!isCompleted) totalActive++;

      const isAtRisk = ctx!.deadlineRisk.isAtRisk;
      if (isAtRisk) atRiskCount++;

      const hasBlockingIssues = ctx!.blockers.some((b) => b.severity === 'BLOCKING');
      if (hasBlockingIssues) blockedCount++;

      const hasMissingPhotos = ctx!.items.some((i) => !i.isPhotographed && i.isInstalled);
      if (hasMissingPhotos) missingPhotosCount++;

      if (ctx!.billingReadiness.isReady) readyForBillingCount++;

      return {
        id: ctx!.orderId,
        orderNumber: ctx!.orderNumber,
        title: ctx!.offerTitle || `Zakázka ${ctx!.orderNumber}`,
        clientName: ctx!.clientName,
        projectType: ctx!.projectType,
        status: ctx!.status,
        overallPhase: ctx!.overallPhase,
        campaign: ctx!.campaign,
        surfaceCount: ctx!.items.length,
        installedCount: ctx!.items.filter((i) => i.isInstalled).length,
        photographedCount: ctx!.items.filter((i) => i.isPhotographed).length,
        blockersCount: ctx!.blockers.length,
        hasBlockingIssues,
        isAtRisk,
        deadlineRiskReason: ctx!.deadlineRisk.reason,
        isReadyForBilling: ctx!.billingReadiness.isReady,
        nextBestAction: ctx!.blockers[0]?.title || (ctx!.billingReadiness.isReady ? 'Předat k fakturaci' : 'Sledovat montáž'),
      };
    });

    return NextResponse.json({
      kpi: {
        totalActive,
        atRiskCount,
        blockedCount,
        missingPhotosCount,
        readyForBillingCount,
      },
      orders: items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při načítání přehledu realizací.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
