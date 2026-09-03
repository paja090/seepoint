import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';
import { createNavigationInvoicePdf, validateNavigationInvoiceParties, type NavigationInvoiceParty } from '@/lib/navigation/invoice-pdf';
import { deletePhotoFromGoogleDrive, downloadFileFromGoogleDrive, uploadDocumentToGoogleDrive } from '@/lib/google-drive';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { createInvoicePartySnapshot, formatInvoiceNumber, invoiceDueDate, invoiceVatAmounts, readInvoicePartySnapshot } from '@/lib/invoice-policy';

export const runtime = 'nodejs';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value);
}

const invoiceDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });
const invoicePeriodDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC' });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('billing');
  if (isApiDenied(auth)) return auth;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${auth.organizationId}:${auth.id}`), rateLimitPolicies.transactionalEmail);
  if (limited) return limited;
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
    if (order.status !== 'PRIPRAVENO_K_FAKTURACI') {
      return NextResponse.json({ error: 'Fakturu lze vystavit pouze u zakázky připravené k fakturaci.' }, { status: 409 });
    }
    if (order.points.length === 0) {
      return NextResponse.json({ error: 'Zakázka nemá žádné fakturovatelné body.' }, { status: 409 });
    }

    const requestedRecipientEmail = order.crmOrder.contact?.email || order.crmOrder.client.email;
    if (!requestedRecipientEmail) {
      return NextResponse.json({ error: 'Klient ani kontaktní osoba nemají vyplněný e-mail.' }, { status: 400 });
    }

    const organization = auth.organization;
    const supplier: NavigationInvoiceParty = {
      name: organization?.name || '',
      companyId: organization?.companyId,
      vatId: organization?.vatId,
      street: organization?.street,
      city: organization?.city,
      postalCode: organization?.postalCode,
      country: organization?.country,
      email: organization?.email,
      phone: organization?.phone,
      bankAccount: organization?.bankAccount,
      iban: organization?.iban,
      swift: organization?.swift,
    };
    const customer: NavigationInvoiceParty = {
      name: order.crmOrder.client.name,
      companyId: order.crmOrder.client.companyId,
      vatId: order.crmOrder.client.dic,
      street: order.crmOrder.client.billingStreet,
      city: order.crmOrder.client.billingCity,
      postalCode: order.crmOrder.client.billingZip,
      country: order.crmOrder.client.billingCountry,
      email: order.crmOrder.client.email,
      phone: order.crmOrder.client.phone,
    };
    const missingInvoiceData = validateNavigationInvoiceParties(supplier, customer);
    if (missingInvoiceData.length > 0) {
      return NextResponse.json({ error: `Fakturu nelze vystavit. Doplňte: ${missingInvoiceData.join(', ')}.` }, { status: 409 });
    }

    let invoice: Prisma.ClientInvoiceGetPayload<object> | null = order.billingPeriods.find((period) => period.invoice)?.invoice ?? null;
    let billingPeriod: Prisma.NavigationBillingPeriodGetPayload<object> | null = order.billingPeriods.find((period) => period.invoiceId === invoice?.id) ?? null;
    if (invoice && invoice.status !== 'ISSUED') {
      return NextResponse.json({ error: `Fakturu ${invoice.invoiceNumber} ve stavu ${invoice.status} nelze znovu odeslat.` }, { status: 409 });
    }

    if (!invoice) {
      const issueDate = new Date();
      const dueDate = invoiceDueDate(issueDate, organization?.invoiceDueDays ?? 14);
      const dateFrom = order.rentStart ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
      const dateTo = order.rentEnd ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0, 23, 59, 59));
      const subtotal = order.points.reduce((sum, point) => sum.plus(point.subtotal), new Prisma.Decimal(0));
      if (!subtotal.isPositive()) {
        return NextResponse.json({ error: 'Celková cena faktury musí být vyšší než nula.' }, { status: 409 });
      }
      const { vatRate, taxAmount, totalAmount } = invoiceVatAmounts(subtotal, organization?.defaultVatRate ?? 21);

      let created: { invoice: Prisma.ClientInvoiceGetPayload<object>; billingPeriod: Prisma.NavigationBillingPeriodGetPayload<object> };
      try {
        created = await prisma.$transaction(async (tx) => {
          const concurrentPeriod = await tx.navigationBillingPeriod.findFirst({
            where: { navigationOrderId: order.id, invoiceId: { not: null } },
            include: { invoice: true },
          });
          if (concurrentPeriod?.invoice) return { invoice: concurrentPeriod.invoice, billingPeriod: concurrentPeriod };

          const sequence = await tx.organization.update({
            where: { id: auth.organizationId! },
            data: { invoiceSequence: { increment: 1 } },
            select: { invoiceSequence: true, invoiceNumberPrefix: true },
          });
          const invoiceNumber = formatInvoiceNumber(sequence.invoiceNumberPrefix, sequence.invoiceSequence);
          const variableSymbol = String(sequence.invoiceSequence).slice(-10);
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
              currency: organization?.defaultCurrency || 'CZK',
              note: `Navigační zakázka ${order.crmOrder.orderNumber}`,
              recipientEmail: requestedRecipientEmail,
              supplierSnapshot: createInvoicePartySnapshot(supplier),
              customerSnapshot: createInvoicePartySnapshot(customer),
              items: {
                create: order.points.map((point) => {
                  const amount = new Prisma.Decimal(point.subtotal);
                  const pointTax = invoiceVatAmounts(amount, vatRate);
                  return {
                    description: point.label,
                    quantity: point.quantity,
                    unit: 'ks',
                    unitPrice: point.unitPrice,
                    amount,
                    vatRate,
                    vatAmount: pointTax.taxAmount,
                    totalAmount: pointTax.totalAmount,
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
          });
          return { invoice: createdInvoice, billingPeriod: createdPeriod };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2002', 'P2034'].includes(error.code)) throw error;
        const existingPeriod = await prisma.navigationBillingPeriod.findFirst({
          where: { navigationOrderId: order.id, invoiceId: { not: null } },
          include: { invoice: true },
        });
        if (!existingPeriod?.invoice) throw error;
        created = { invoice: existingPeriod.invoice, billingPeriod: existingPeriod };
      }
      invoice = created.invoice;
      billingPeriod = created.billingPeriod;
    }
    if (!billingPeriod) throw new Error('Fakturační období nebylo nalezeno.');
    const recipientEmail = invoice.recipientEmail || requestedRecipientEmail;
    const invoiceSupplier = readInvoicePartySnapshot(invoice.supplierSnapshot, supplier);
    const invoiceCustomer = readInvoicePartySnapshot(invoice.customerSnapshot, customer);
    const invoiceItems = await prisma.clientInvoiceItem.findMany({
      where: { clientInvoiceId: invoice.id },
      orderBy: { id: 'asc' },
    });
    if (invoiceItems.length === 0) throw new Error('Faktura nemá uložené položky.');

    const pdfFileName = `faktura-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
    let invoicePdf: Buffer;
    if (!invoice.driveFileId) {
      invoicePdf = await createNavigationInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        variableSymbol: invoice.variableSymbol,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        supplier: invoiceSupplier,
        customer: invoiceCustomer,
        orderNumber: order.crmOrder.orderNumber,
        orderTitle: order.crmOrder.title,
        periodFrom: billingPeriod.dateFrom,
        periodTo: billingPeriod.dateTo,
        items: invoiceItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          amount: Number(item.amount),
          vatRate: Number(item.vatRate),
          vatAmount: Number(item.vatAmount),
          totalAmount: Number(item.totalAmount),
        })),
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.totalAmount),
      });
      const stored = await uploadDocumentToGoogleDrive(
        new File([new Uint8Array(invoicePdf)], pdfFileName, { type: 'application/pdf' }),
        pdfFileName,
        invoice.id,
      );
      try {
        invoice = await prisma.clientInvoice.update({
          where: { id: invoice.id },
          data: { driveFileId: stored.id, pdfUrl: `/api/crm/invoices/${invoice.id}/pdf` },
        });
      } catch (error) {
        await deletePhotoFromGoogleDrive(stored.id).catch(() => undefined);
        throw error;
      }
    } else {
      const storedPdf = await downloadFileFromGoogleDrive(invoice.driveFileId);
      if (!storedPdf.ok) throw new Error('Uložené PDF faktury se nepodařilo načíst pro odeslání.');
      invoicePdf = Buffer.from(await storedPdf.arrayBuffer());
      if (!invoice.pdfUrl) {
        invoice = await prisma.clientInvoice.update({
          where: { id: invoice.id },
          data: { pdfUrl: `/api/crm/invoices/${invoice.id}/pdf` },
        });
      }
    }

    const message = [
      `Dobrý den,`,
      '',
      `zasíláme vám fakturu ${invoice.invoiceNumber} za navigační zakázku ${order.crmOrder.orderNumber}.`,
      `Částka k úhradě: ${formatMoney(Number(invoice.totalAmount), invoice.currency)}`,
      `Variabilní symbol: ${invoice.variableSymbol || 'neuveden'}`,
      `Datum splatnosti: ${invoiceDateFormatter.format(invoice.dueDate)}`,
      '',
      'Daňový doklad je přiložen ve formátu PDF.',
      '',
      'S pozdravem',
      'Tým SeePOINT',
    ].join('\n');

    const emailDelivery = await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Faktura ${invoice.invoiceNumber} – SeePOINT`,
      message,
      template: 'navigation-invoice',
      attachments: [{ filename: pdfFileName, content: invoicePdf, contentType: 'application/pdf' }],
      idempotencyKey: `navigation-invoice/${invoice.id}`,
    });

    if (emailDelivery.status === 'skipped') {
      return NextResponse.json({
        success: true,
        delivered: false,
        message: `Preview: faktura ${invoice.invoiceNumber} byla vytvořena a bezpečně uložena, ale e-mail nebyl odeslán. Stav zůstává VYSTAVENO.`,
        billingPeriod: {
          id: billingPeriod.id,
          dateFrom: billingPeriod.dateFrom.toISOString(),
          dateTo: billingPeriod.dateTo.toISOString(),
          dateFromLabel: invoicePeriodDateFormatter.format(billingPeriod.dateFrom),
          dateToLabel: invoicePeriodDateFormatter.format(billingPeriod.dateTo),
          amount: Number(billingPeriod.amount),
          status: billingPeriod.status,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        },
      }, { status: 202 });
    }

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
          detailsJson: JSON.stringify({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, recipientEmail, driveFileId: invoice.driveFileId }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      delivered: true,
      message: `Faktura ${sentInvoice.invoiceNumber} byla odeslána na ${recipientEmail}.`,
      billingPeriod: {
        id: sentPeriod.id,
        dateFrom: sentPeriod.dateFrom.toISOString(),
        dateTo: sentPeriod.dateTo.toISOString(),
        dateFromLabel: invoicePeriodDateFormatter.format(sentPeriod.dateFrom),
        dateToLabel: invoicePeriodDateFormatter.format(sentPeriod.dateTo),
        amount: Number(sentPeriod.amount),
        status: sentPeriod.status,
        invoiceId: sentInvoice.id,
        invoiceNumber: sentInvoice.invoiceNumber,
      },
    });
  } catch (error: unknown) {
    console.error('[navigation/invoice] Creation or delivery failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Fakturu se nepodařilo vytvořit nebo odeslat. Zkontrolujte konfiguraci a zkuste to znovu.' }, { status: 500 });
  }
}
