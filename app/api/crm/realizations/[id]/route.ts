import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmOrderValidationError, parseUpdateRealizationInput } from '@/lib/crm/order-policy';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  const { id } = await context.params;
  const organizationId = auth.organizationId;

  let parsed;
  try {
    const rawBody = await req.json().catch(() => null);
    parsed = parseUpdateRealizationInput(rawBody);
  } catch (error) {
    if (error instanceof CrmOrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.crmRealization.findFirst({
        where: { id, organizationId },
        select: {
          id: true,
          branchId: true,
          crmOrderId: true,
          crmOrder: { select: { id: true, clientId: true, orderNumber: true } },
          workOrderItem: { select: { id: true } },
        },
      });
      if (!existing) {
        return { error: 'Realizační pozice nebyla nalezena.', status: 404 as const };
      }

      const data: Prisma.CrmRealizationUncheckedUpdateInput = {};
      if (parsed.status !== undefined) data.status = parsed.status;
      if (parsed.plannedDate !== undefined) data.plannedDate = parsed.plannedDate;
      if (parsed.actualDate !== undefined) data.actualDate = parsed.actualDate;
      if (parsed.note !== undefined) data.note = parsed.note;
      if (parsed.claimNote !== undefined) data.claimNote = parsed.claimNote;

      if (parsed.branchId !== undefined) {
        if (parsed.branchId === null) {
          data.branchId = null;
        } else {
          const branch = await tx.clientBranch.findFirst({
            where: {
              id: parsed.branchId,
              clientId: existing.crmOrder.clientId,
              organizationId,
              active: true,
            },
            select: { id: true },
          });
          if (!branch) {
            return { error: 'Vybraná pobočka nepatří klientovi této zakázky.', status: 400 as const };
          }
          data.branchId = branch.id;
        }
      }

      const realization = await tx.crmRealization.update({
        where: { id: existing.id },
        data,
        include: {
          branch: { select: { id: true, name: true, code: true, city: true } },
          carrier: { select: { id: true, code: true, name: true, city: true } },
          surface: { select: { id: true, name: true } },
          assignedUser: { select: { name: true } },
        },
      });

      // Keep linked WorkOrderItem and unassigned realization photos in sync with branch assignment
      if (parsed.branchId !== undefined) {
        if (existing.workOrderItem) {
          await tx.workOrderItem.update({
            where: { id: existing.workOrderItem.id },
            data: { branchId: parsed.branchId },
          });
        }
        if (parsed.propagateToPhotos && parsed.branchId) {
          await tx.photo.updateMany({
            where: {
              organizationId,
              crmRealizationId: existing.id,
              branchId: existing.branchId ?? null,
            },
            data: { branchId: parsed.branchId },
          });
        }
      }

      await tx.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'UPDATE_CRM_REALIZATION',
          entityType: 'CrmRealization',
          entityId: realization.id,
          detailsJson: JSON.stringify({
            orderNumber: existing.crmOrder.orderNumber,
            branchId: realization.branchId,
            status: realization.status,
          }),
        },
      });

      return { realization };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, realization: result.realization });
  } catch (error) {
    console.error('[crm/realizations/[id]] PATCH failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Pozici se nepodařilo upravit.' }, { status: 500 });
  }
}
