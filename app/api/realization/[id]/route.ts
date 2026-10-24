import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import {
  buildRealizationContext,
  determineRealizationNextBestActions,
} from '@/lib/ai-realization/realization-engine';
import { buildDeterministicRealizationInsights } from '@/lib/ai-realization/realization-insights';
import { prisma } from '@/lib/db';
import type { CrmOrderStatus, Prisma, RealizationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('realization');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const profile = await getOrganizationRealizationProfile(auth.organizationId!);
    const context = await buildRealizationContext(id, auth, profile);

    if (!context) {
      return NextResponse.json({ error: 'Realizační zakázka nebyla nalezena.' }, { status: 404 });
    }

    const nextBestActions = determineRealizationNextBestActions(context);
    const insights = buildDeterministicRealizationInsights(context);

    return NextResponse.json({
      context,
      nextBestActions,
      insights,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při načítání detailu realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('realization');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const organizationId = auth.organizationId!;
    const body = await request.json();

    const order = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        OR: [{ id }, { offerId: id }],
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Realizační zakázka nebyla nalezena.' }, { status: 404 });
    }

    const updates: Prisma.CrmOrderUpdateInput = {};

    if (typeof body.clientOrderCode !== 'undefined') {
      updates.clientOrderCode = body.clientOrderCode ? String(body.clientOrderCode).trim() : null;
    }
    if (typeof body.dateFrom !== 'undefined') {
      updates.dateFrom = body.dateFrom ? new Date(body.dateFrom) : null;
    }
    if (typeof body.dateTo !== 'undefined') {
      updates.dateTo = body.dateTo ? new Date(body.dateTo) : null;
    }
    if (typeof body.note !== 'undefined') {
      updates.note = body.note ? String(body.note).trim() : null;
    }
    if (typeof body.internalNote !== 'undefined') {
      updates.internalNote = body.internalNote ? String(body.internalNote).trim() : null;
    }
    if (typeof body.status !== 'undefined') {
      updates.status = body.status as CrmOrderStatus;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.crmOrder.update({
        where: { id: order.id },
        data: updates,
      });
    }

    // Support updating individual realization items (e.g. lavička / horizont marked as INSTALLED or PHOTOGRAPHED)
    if (body.realizationItemId && body.itemStatus) {
      await prisma.crmRealization.updateMany({
        where: {
          id: String(body.realizationItemId),
          crmOrderId: order.id,
          organizationId,
        },
        data: {
          status: body.itemStatus as RealizationStatus,
          ...(body.itemStatus === 'INSTALLED' || body.itemStatus === 'PHOTOGRAPHED' || body.itemStatus === 'COMPLETED'
            ? { actualDate: new Date() }
            : {}),
        },
      });
    }

    // Support advancing overall phase if targetPhase is sent
    if (body.targetPhase) {
      const targetPhase = String(body.targetPhase);
      if (targetPhase === 'COMPLETED' || targetPhase === 'READY_FOR_BILLING') {
        await prisma.crmRealization.updateMany({
          where: { crmOrderId: order.id, organizationId, status: { not: 'COMPLETED' } },
          data: { status: 'COMPLETED', actualDate: new Date() },
        });
        await prisma.crmOrder.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });
      } else if (targetPhase === 'INSTALLATION') {
        await prisma.crmRealization.updateMany({
          where: { crmOrderId: order.id, organizationId, status: 'WAITING_FOR_MATERIALS' },
          data: { status: 'SCHEDULED' },
        });
        await prisma.crmOrder.update({
          where: { id: order.id },
          data: { status: 'IN_REALIZATION' },
        });
      } else if (targetPhase === 'PRODUCTION') {
        await prisma.printProductionJob.updateMany({
          where: { organizationId, offerId: order.offerId || undefined, status: 'PREPARATION' },
          data: { status: 'IN_PRINT' },
        });
      }
    }

    const profile = await getOrganizationRealizationProfile(organizationId);
    const updatedContext = await buildRealizationContext(order.id, auth, profile);

    return NextResponse.json({
      success: true,
      message: 'Zakázka byla úspěšně aktualizována.',
      context: updatedContext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při aktualizaci realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
