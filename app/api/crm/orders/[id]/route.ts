import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmOrderValidationError, parseUpdateCrmOrderInput } from '@/lib/crm/order-policy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  const { id } = await context.params;
  const order = await prisma.crmOrder.findFirst({
    where: { id, organizationId: auth.organizationId },
    include: {
      client: { select: { id: true, name: true, companyId: true } },
      agencyClient: { select: { id: true, name: true, companyId: true } },
      branch: { select: { id: true, name: true, code: true, city: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      assignedUser: { select: { id: true, name: true } },
      realizations: {
        orderBy: { createdAt: 'asc' },
        include: {
          branch: { select: { id: true, name: true, code: true, city: true } },
          carrier: { select: { id: true, code: true, name: true, city: true } },
          surface: { select: { id: true, name: true } },
        },
      },
      _count: { select: { workOrders: true, clientInvoices: true, realizations: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Zakázka nebyla nalezena.' }, { status: 404 });
  }

  return NextResponse.json({ order });
}

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
    parsed = parseUpdateCrmOrderInput(rawBody);
  } catch (error) {
    if (error instanceof CrmOrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.crmOrder.findFirst({
        where: { id, organizationId },
        select: {
          id: true,
          clientId: true,
          orderNumber: true,
          agencyClientId: true,
          agencyName: true,
          branchId: true,
          dateFrom: true,
          dateTo: true,
        },
      });
      if (!existing) {
        return { error: 'Zakázka nebyla nalezena.', status: 404 as const };
      }

      const nextDateFrom = parsed.dateFrom !== undefined ? parsed.dateFrom : existing.dateFrom;
      const nextDateTo = parsed.dateTo !== undefined ? parsed.dateTo : existing.dateTo;
      if (nextDateFrom && nextDateTo && nextDateFrom > nextDateTo) {
        return { error: 'Datum začátku nemůže být po datu konce zakázky.', status: 400 as const };
      }

      const data: Prisma.CrmOrderUncheckedUpdateInput = {};
      if (parsed.title !== undefined) data.title = parsed.title;
      if (parsed.clientOrderCode !== undefined) data.clientOrderCode = parsed.clientOrderCode;
      if (parsed.projectType !== undefined) data.projectType = parsed.projectType;
      if (parsed.status !== undefined) data.status = parsed.status;
      if (parsed.dateFrom !== undefined) data.dateFrom = parsed.dateFrom;
      if (parsed.dateTo !== undefined) data.dateTo = parsed.dateTo;
      if (parsed.totalPrice !== undefined) data.totalPrice = parsed.totalPrice;
      if (parsed.billingMethod !== undefined) data.billingMethod = parsed.billingMethod;
      if (parsed.note !== undefined) data.note = parsed.note;
      if (parsed.internalNote !== undefined) data.internalNote = parsed.internalNote;

      if (parsed.agencyClientId !== undefined) {
        if (parsed.agencyClientId === null) {
          data.agencyClientId = null;
          // If agencyClientId is explicitly cleared and agencyName wasn't provided, keep agencyName only if explicitly set
          if (parsed.agencyName === undefined) {
            data.agencyName = null;
          }
        } else {
          const agency = await tx.client.findFirst({
            where: { id: parsed.agencyClientId, organizationId, active: true },
            select: { id: true, name: true },
          });
          if (!agency) {
            return { error: 'Vybraná agentura nebyla v CRM nalezena.', status: 400 as const };
          }
          data.agencyClientId = agency.id;
          if (parsed.agencyName === undefined) {
            data.agencyName = agency.name;
          }
        }
      }

      if (parsed.agencyName !== undefined) {
        data.agencyName = parsed.agencyName;
      }

      if (parsed.branchId !== undefined) {
        if (parsed.branchId === null) {
          data.branchId = null;
        } else {
          const branch = await tx.clientBranch.findFirst({
            where: { id: parsed.branchId, clientId: existing.clientId, organizationId, active: true },
            select: { id: true },
          });
          if (!branch) {
            return { error: 'Vybraná pobočka nepatří koncovému klientovi této zakázky.', status: 400 as const };
          }
          data.branchId = branch.id;
        }
      }

      if (parsed.contactId !== undefined) {
        if (parsed.contactId === null) {
          data.contactId = null;
        } else {
          const contact = await tx.clientContact.findFirst({
            where: { id: parsed.contactId, clientId: existing.clientId, organizationId, active: true },
            select: { id: true },
          });
          if (!contact) {
            return { error: 'Vybraný kontakt nepatří klientovi této zakázky.', status: 400 as const };
          }
          data.contactId = contact.id;
        }
      }

      if (parsed.assignedUserId !== undefined) {
        if (parsed.assignedUserId === null) {
          data.assignedUserId = null;
        } else {
          const memberCount = await tx.organizationMember.count({
            where: { organizationId, userId: parsed.assignedUserId, isActive: true },
          });
          if (!memberCount) {
            return { error: 'Přiřazený obchodník není aktivním členem organizace.', status: 400 as const };
          }
          data.assignedUserId = parsed.assignedUserId;
        }
      }

      const order = await tx.crmOrder.update({
        where: { id: existing.id },
        data,
        include: {
          client: { select: { id: true, name: true, companyId: true } },
          agencyClient: { select: { id: true, name: true, companyId: true } },
          branch: { select: { id: true, name: true, code: true, city: true } },
          assignedUser: { select: { id: true, name: true } },
          _count: { select: { workOrders: true, clientInvoices: true, realizations: true } },
        },
      });

      await tx.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'UPDATE_CRM_ORDER',
          entityType: 'CrmOrder',
          entityId: order.id,
          detailsJson: JSON.stringify({
            orderNumber: existing.orderNumber,
            agencyClientId: order.agencyClientId,
            agencyName: order.agencyName,
            branchId: order.branchId,
            status: order.status,
          }),
        },
      });

      return { order };
    });

    if ('error' in updated) {
      return NextResponse.json({ error: updated.error }, { status: updated.status });
    }

    return NextResponse.json({ ok: true, order: updated.order });
  } catch (error) {
    console.error('[crm/orders/[id]] PATCH failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Zakázku se nepodařilo aktualizovat.' }, { status: 500 });
  }
}
