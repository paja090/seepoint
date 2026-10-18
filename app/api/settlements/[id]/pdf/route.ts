import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildSettlementInvoiceData, createSettlementInvoicePdf } from '@/lib/settlement-invoice';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess(['settlements', 'mySettlements']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }

    const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
    const isOwner = settlement.employee.userId === user.id || settlement.employee.email === user.email;

    if (!isPrivileged && !isOwner) {
      return NextResponse.json({ error: 'Nemáte oprávnění k tomuto vyúčtování.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const scopeParam = url.searchParams.get('scope');
    const scope = scopeParam === 'WORK_ONLY' || scopeParam === 'ALL' ? scopeParam : undefined;

    const invoiceData = await buildSettlementInvoiceData(id, undefined, { scope });
    const pdfBuffer = await createSettlementInvoicePdf(invoiceData);

    const safeNum = invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const scopeSuffix = invoiceData.scope === 'WORK_ONLY' ? '-pouze-prace' : '';
    const filename = `vyuctovani-${invoiceData.periodYear}-${String(invoiceData.periodMonth).padStart(2, '0')}-${safeNum}${scopeSuffix}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Nastala chyba při generování PDF.' }, { status: 500 });
  }
}
