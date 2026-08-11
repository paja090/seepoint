import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(value);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  try {
    const order = await prisma.navigationOrder.findUnique({
      where: { id },
      include: {
        crmOrder: { include: { client: true, contact: true } },
        points: { orderBy: { sortOrder: 'asc' } },
        billingPeriods: { include: { invoice: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Navigační zakázka nebyla nalezena.' }, { status: 404 });

    const recipientEmail = order.crmOrder.contact?.email || order.crmOrder.client.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: 'Klient ani kontaktní osoba nemají vyplněný e-mail.' }, { status: 400 });
    }

    let invoice = order.billingPeriods.find((period) => period.invoice)?.invoice ?? null;
    let billingPeriod = order.billingPeriods.find((period) => period.invoiceId === invoice?.id) ?? null;

    if (!invoice) {
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);
      const dateFrom = order.rentStart ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
      const dateTo = order.rentEnd ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0, 23, 59, 59));
      const subtotal = order.points.reduce((sum, point) => sum + Number(point.subtotal), 0);
      const taxAmount = Math.round(subtotal * 0.21 * 100) / 100;
      const totalAmount = subtotal + taxAmount;
      const invoiceNumber = `NAV-${order.crmOrder.orderNumber}`;
      const variableSymbol = invoiceNumber.replace(/\D/g, '').slice(-10);

      const created = await prisma.$transaction(async (tx) => {
        const createdInvoice = await tx.clientInvoice.create({
          data: {
            clientId: order.crmOrder.clientId,
            crmOrderId: order.crmOrderId,
            invoiceNumber,
            variableSymbol,
            status: 'ISSUED',
            issueDate,
            dueDate,
            subtotal,
            taxAmount,
            totalAmount,
            note: `Navigační zakázka ${order.crmOrder.orderNumber}`,
            items: {
              create: order.points.map((point) => {
                const amount = Number(point.subtotal);
                const vatAmount = Math.round(amount * 0.21 * 100) / 100;
                return {
                  description: point.label,
                  quantity: point.quantity,
                  unit: 'ks',
                  unitPrice: point.unitPrice,
                  amount,
                  vatRate: 21,
                  vatAmount,
                  totalAmount: amount + vatAmount,
                };
              }),
            },
          },
        });
        const createdPeriod = await tx.navigationBillingPeriod.create({
          data: {
            navigationOrderId: order.id,
            dateFrom,
            dateTo,
            invoiceId: createdInvoice.id,
            status: 'ISSUED',
            amount: totalAmount,
            invoicedAt: issueDate,
          },
          include: { invoice: true },
        });
        return { invoice: createdInvoice, billingPeriod: createdPeriod };
      });
      invoice = created.invoice;
      billingPeriod = created.billingPeriod;
    }

    const message = [
      `Dobrý den,`,
      '',
      `zasíláme vám fakturu ${invoice.invoiceNumber} za navigační zakázku ${order.crmOrder.orderNumber}.`,
      `Částka k úhradě: ${formatMoney(Number(invoice.totalAmount))}`,
      `Variabilní symbol: ${invoice.variableSymbol || 'neuveden'}`,
      `Datum splatnosti: ${invoice.dueDate.toLocaleDateString('cs-CZ')}`,
      '',
      'S pozdravem',
      'Tým SeePOINT',
    ].join('\n');

    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Faktura ${invoice.invoiceNumber} – SeePOINT`,
      message,
      template: 'navigation-invoice',
    });

    const [sentInvoice, sentPeriod] = await prisma.$transaction([
      prisma.clientInvoice.update({ where: { id: invoice.id }, data: { status: 'SENT' } }),
      prisma.navigationBillingPeriod.update({
        where: { id: billingPeriod!.id },
        data: { status: 'SENT', invoicedAt: new Date() },
      }),
      prisma.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'NAVIGATION_INVOICE_SENT',
          entityType: 'NavigationOrder',
          entityId: order.id,
          detailsJson: JSON.stringify({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, recipientEmail }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Faktura ${sentInvoice.invoiceNumber} byla odeslána na ${recipientEmail}.`,
      billingPeriod: {
        id: sentPeriod.id,
        dateFrom: sentPeriod.dateFrom.toISOString(),
        dateTo: sentPeriod.dateTo.toISOString(),
        amount: Number(sentPeriod.amount),
        status: sentPeriod.status,
        invoiceId: sentInvoice.id,
        invoiceNumber: sentInvoice.invoiceNumber,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Fakturu se nepodařilo vytvořit nebo odeslat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
