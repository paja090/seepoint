import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { createNavigationInvoicePdf, validateNavigationInvoiceParties, type NavigationInvoiceParty } from '@/lib/navigation/invoice-pdf';
import { formatInvoiceNumber, invoiceDueDate, invoiceVatAmounts } from '@/lib/invoice-policy';

export const runtime = 'nodejs';

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value);
}

const invoiceDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('billing', 'navigation');
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

    if (!order) {
      return NextResponse.json({ error: 'Navigační zakázka nebyla nalezena.' }, { status: 404 });
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

    const existingPeriod = order.billingPeriods.find((period) => period.invoice);
    const existingInvoice = existingPeriod?.invoice ?? null;

    const issueDate = existingInvoice?.issueDate ?? new Date();
    const defaultDueDays = organization?.invoiceDueDays ?? 14;
    const dueDate = existingInvoice?.dueDate ?? invoiceDueDate(issueDate, defaultDueDays);
    const periodFrom = order.rentStart ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
    const periodTo = order.rentEnd ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0, 23, 59, 59));

    const nextSeq = (organization?.invoiceSequence ?? 0) + 1;
    const invoiceNumber = existingInvoice?.invoiceNumber ?? formatInvoiceNumber(organization?.invoiceNumberPrefix, nextSeq);
    const variableSymbol = existingInvoice?.variableSymbol ?? String(nextSeq).slice(-10);
    const defaultVatRate = organization?.defaultVatRate ?? 21;
    const currency = existingInvoice?.currency || organization?.defaultCurrency || 'CZK';

    let items: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      vatRate: number;
    }> = [];

    if (existingInvoice) {
      const storedItems = await prisma.clientInvoiceItem.findMany({
        where: { clientInvoiceId: existingInvoice.id },
        orderBy: { id: 'asc' },
      });
      items = storedItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
      }));
    } else if (order.points.length > 0) {
      items = order.points.map((point) => ({
        description: point.label,
        quantity: point.quantity,
        unit: 'ks',
        unitPrice: Number(point.unitPrice),
        vatRate: defaultVatRate,
      }));
    } else {
      items = [
        {
          description: `Navigační kampaň – ${order.crmOrder.title}`,
          quantity: 1,
          unit: 'kpl',
          unitPrice: Number(order.totalPrice || 0),
          vatRate: defaultVatRate,
        },
      ];
    }

    const requestedRecipientEmail =
      existingInvoice?.recipientEmail ||
      order.crmOrder.contact?.email ||
      order.crmOrder.client.email ||
      '';

    const defaultSubject = `Faktura ${invoiceNumber} – ${order.crmOrder.orderNumber} – SeePOINT`;
    const defaultGreeting = 'Dobrý den,';
    const defaultMessage = `zasíláme vám fakturu ${invoiceNumber} za navigační zakázku ${order.crmOrder.orderNumber}.\n\nDaňový doklad je přiložen ve formátu PDF se všemi náležitostmi a platebními údaji.`;
    const defaultClosingNote = 'V případě dotazů nebo požadavku na upřesnění nás prosím kontaktujte.';

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.crmOrder.orderNumber,
        orderTitle: order.crmOrder.title,
        clientName: order.crmOrder.client.name,
        invoiceNumber,
        variableSymbol,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        dueDays: defaultDueDays,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodTo.toISOString(),
        currency,
        defaultVatRate,
        supplier,
        customer,
        missingInvoiceData,
        recipientEmail: requestedRecipientEmail,
        items,
        defaultSubject,
        defaultGreeting,
        defaultMessage,
        defaultClosingNote,
        existingInvoice: existingInvoice
          ? {
              id: existingInvoice.id,
              invoiceNumber: existingInvoice.invoiceNumber,
              status: existingInvoice.status,
              totalAmount: Number(existingInvoice.totalAmount),
              driveFileId: existingInvoice.driveFileId,
              pdfUrl: existingInvoice.pdfUrl,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    console.error('[navigation/invoice/preview] Failed to load preview', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Chyba při načítání návrhu faktury.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('billing', 'navigation');
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

    if (!order) {
      return NextResponse.json({ error: 'Navigační zakázka nebyla nalezena.' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      customItems?: Array<{
        description: string;
        quantity: number;
        unit?: string;
        unitPrice: number;
        vatRate?: number;
      }>;
      dueDays?: number;
      issueDate?: string;
      dueDate?: string;
      periodFrom?: string;
      periodTo?: string;
      invoiceNumber?: string;
      variableSymbol?: string;
    };

    const organization = auth.organization;
    const supplier: NavigationInvoiceParty = {
      name: organization?.name || 'SeePOINT s.r.o.',
      companyId: organization?.companyId || '',
      vatId: organization?.vatId || '',
      street: organization?.street || '',
      city: organization?.city || '',
      postalCode: organization?.postalCode || '',
      country: organization?.country || 'CZ',
      email: organization?.email || '',
      phone: organization?.phone || '',
      bankAccount: organization?.bankAccount || '',
      iban: organization?.iban || '',
      swift: organization?.swift || '',
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

    const existingPeriod = order.billingPeriods.find((period) => period.invoice);
    const existingInvoice = existingPeriod?.invoice ?? null;

    const issueDate = body.issueDate ? new Date(body.issueDate) : (existingInvoice?.issueDate ?? new Date());
    const dueDays = typeof body.dueDays === 'number' && body.dueDays >= 1 ? body.dueDays : (organization?.invoiceDueDays ?? 14);
    const dueDate = body.dueDate ? new Date(body.dueDate) : (existingInvoice?.dueDate ?? invoiceDueDate(issueDate, dueDays));
    const periodFrom = body.periodFrom
      ? new Date(body.periodFrom)
      : (order.rentStart ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1)));
    const periodTo = body.periodTo
      ? new Date(body.periodTo)
      : (order.rentEnd ?? new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0, 23, 59, 59)));

    const nextSeq = (organization?.invoiceSequence ?? 0) + 1;
    const invoiceNumber = body.invoiceNumber || existingInvoice?.invoiceNumber || formatInvoiceNumber(organization?.invoiceNumberPrefix, nextSeq);
    const variableSymbol = body.variableSymbol || existingInvoice?.variableSymbol || String(nextSeq).slice(-10);
    const currency = existingInvoice?.currency || organization?.defaultCurrency || 'CZK';
    const defaultVatRate = organization?.defaultVatRate ?? 21;

    const rawItems = Array.isArray(body.customItems) && body.customItems.length > 0
      ? body.customItems
      : order.points.map((p) => ({
          description: p.label,
          quantity: p.quantity,
          unit: 'ks',
          unitPrice: Number(p.unitPrice),
          vatRate: defaultVatRate,
        }));

    const calculatedItems = rawItems.map((it) => {
      const quantity = Math.max(0.01, Number(it.quantity) || 1);
      const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
      const vatRate = typeof it.vatRate === 'number' ? it.vatRate : defaultVatRate;
      const amount = Math.round(quantity * unitPrice * 100) / 100;
      const { taxAmount: vatAmount, totalAmount } = invoiceVatAmounts(amount, vatRate);
      return {
        description: it.description || 'Položka faktury',
        quantity,
        unit: it.unit || 'ks',
        unitPrice,
        amount,
        vatRate,
        vatAmount: Number(vatAmount),
        totalAmount: Number(totalAmount),
      };
    });

    const subtotal = calculatedItems.reduce((acc, it) => acc + it.amount, 0);
    const taxAmount = calculatedItems.reduce((acc, it) => acc + it.vatAmount, 0);
    const totalAmount = subtotal + taxAmount;

    const url = new URL(request.url);
    const isPdfRequested = url.searchParams.get('format') === 'pdf' || request.headers.get('accept')?.includes('application/pdf');

    if (isPdfRequested) {
      const pdfBuffer = await createNavigationInvoicePdf({
        invoiceNumber,
        variableSymbol,
        issueDate,
        dueDate,
        currency,
        supplier,
        customer,
        orderNumber: order.crmOrder.orderNumber,
        orderTitle: order.crmOrder.title,
        periodFrom,
        periodTo,
        items: calculatedItems,
        subtotal,
        taxAmount,
        totalAmount,
      });

      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="nahled-faktury-${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf"`,
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return NextResponse.json({
      success: true,
      draft: {
        invoiceNumber,
        variableSymbol,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        dueDays,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodTo.toISOString(),
        currency,
        supplier,
        customer,
        items: calculatedItems,
        subtotal,
        taxAmount,
        totalAmount,
        formattedTotal: formatMoney(totalAmount, currency),
        formattedDueDate: invoiceDateFormatter.format(dueDate),
      },
    });
  } catch (error: unknown) {
    console.error('[navigation/invoice/preview] Failed to generate preview', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Chyba při generování náhledu faktury.' }, { status: 500 });
  }
}
