import { NextResponse } from 'next/server';
import { Prisma, type CrmOrderStatus, type RealizationStatus } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import {
  buildRealizationContext,
  determineRealizationNextBestActions,
} from '@/lib/ai-realization/realization-engine';
import { buildDeterministicRealizationInsights } from '@/lib/ai-realization/realization-insights';
import { prisma } from '@/lib/db';
import { formatInvoiceNumber, invoiceDueDate, invoiceVatAmounts } from '@/lib/invoice-policy';

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
      include: {
        navigationOrder: {
          include: { points: true },
        },
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

    // Support updating individual realization items (including synthesized workOrder/order items)
    if (body.realizationItemId && body.itemStatus) {
      const targetItemId = String(body.realizationItemId);
      const isInstalledTarget =
        body.itemStatus === 'INSTALLED' ||
        body.itemStatus === 'PHOTOGRAPHED' ||
        body.itemStatus === 'COMPLETED';

      const updatedRealization = await prisma.crmRealization.updateMany({
        where: {
          id: targetItemId,
          crmOrderId: order.id,
          organizationId,
        },
        data: {
          status: body.itemStatus as RealizationStatus,
          ...(isInstalledTarget ? { actualDate: new Date() } : {}),
        },
      });

      if (updatedRealization.count === 0) {
        if (targetItemId === order.id) {
          await prisma.crmOrder.update({
            where: { id: order.id },
            data: { status: isInstalledTarget ? 'ACTIVE' : 'IN_REALIZATION' },
          });
        } else {
          await prisma.workOrder.updateMany({
            where: { id: targetItemId, crmOrderId: order.id, organizationId },
            data: { status: isInstalledTarget ? 'DONE' : 'PLANNED' },
          });
        }
      }
    }

    // Support 1-click invoice generation from Realization detail
    let createdInvoice: { id: string; invoiceNumber: string; totalAmount: string } | null = null;
    if (body.action === 'CREATE_INVOICE') {
      const existingInvoice = await prisma.clientInvoice.findFirst({
        where: { organizationId, crmOrderId: order.id, status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
      });

      if (existingInvoice) {
        createdInvoice = {
          id: existingInvoice.id,
          invoiceNumber: existingInvoice.invoiceNumber,
          totalAmount: existingInvoice.totalAmount.toString(),
        };
      } else {
        const org = await prisma.organization.update({
          where: { id: organizationId },
          data: { invoiceSequence: { increment: 1 } },
          select: { invoiceNumberPrefix: true, invoiceSequence: true, invoiceDueDays: true, defaultVatRate: true },
        });
        const issueDate = new Date();
        const dueDate = invoiceDueDate(issueDate, org.invoiceDueDays ?? 14);
        const vatRateVal = org.defaultVatRate ?? 21;
        const invoiceNumber = formatInvoiceNumber(org.invoiceNumberPrefix || 'FA', org.invoiceSequence);

        let rawSubtotal = order.totalPrice ? Number(order.totalPrice) : 0;
        if (rawSubtotal <= 0 && order.navigationOrder?.points?.length) {
          rawSubtotal = order.navigationOrder.points.reduce((sum, pt) => sum + Number(pt.subtotal || 0), 0);
        }
        const subtotal = new Prisma.Decimal(Math.max(0, rawSubtotal));
        const { vatRate, taxAmount, totalAmount } = invoiceVatAmounts(subtotal, vatRateVal);

        const newInv = await prisma.clientInvoice.create({
          data: {
            organizationId,
            clientId: order.clientId,
            crmOrderId: order.id,
            invoiceNumber,
            variableSymbol: String(org.invoiceSequence).padStart(6, '0'),
            type: 'REGULAR',
            status: 'ISSUED',
            issueDate,
            dueDate,
            subtotal,
            taxAmount,
            totalAmount,
            currency: 'CZK',
            note: order.clientOrderCode ? `Kód objednávky klienta: ${order.clientOrderCode}` : order.title,
            items: {
              create: [
                {
                  organizationId,
                  description: `${order.title} (${order.orderNumber})`,
                  quantity: new Prisma.Decimal(1),
                  unit: 'kampaň',
                  unitPrice: subtotal,
                  amount: subtotal,
                  vatRate,
                  vatAmount: taxAmount,
                  totalAmount,
                },
              ],
            },
          },
        });

        if (order.navigationOrder && order.navigationOrder.status === 'PRIPRAVENO_K_FAKTURACI') {
          await prisma.navigationOrder.update({
            where: { id: order.navigationOrder.id },
            data: { status: 'FAKTUROVANO' },
          });
        }
        await prisma.crmOrder.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });

        createdInvoice = {
          id: newInv.id,
          invoiceNumber: newInv.invoiceNumber,
          totalAmount: newInv.totalAmount.toString(),
        };
      }
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
          data: { status: targetPhase === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE' },
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
      message: createdInvoice
        ? `Faktura ${createdInvoice.invoiceNumber} byla vystavena.`
        : 'Zakázka byla úspěšně aktualizována.',
      invoice: createdInvoice,
      context: updatedContext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při aktualizaci realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

