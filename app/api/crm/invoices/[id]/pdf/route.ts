import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { downloadFileFromGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('billing');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id },
    select: { invoiceNumber: true, driveFileId: true },
  });
  if (!invoice?.driveFileId) return NextResponse.json({ error: 'PDF faktury nebylo nalezeno.' }, { status: 404 });

  const file = await downloadFileFromGoogleDrive(invoice.driveFileId);
  if (!file.ok) return NextResponse.json({ error: 'PDF faktury se nepodařilo načíst.' }, { status: 502 });
  const bytes = await file.arrayBuffer();
  const filename = `faktura-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
