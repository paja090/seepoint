import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmClientValidationError, parseContactInput } from '@/lib/crm/client-policy';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId } = await params;

  try {
    const body = parseContactInput(await req.json().catch(() => null));

    const contact = await prisma.$transaction(async (tx) => {
      const clientExists = await tx.client.count({ where: { id: clientId, active: true } });
      if (!clientExists) throw new Error('CLIENT_NOT_FOUND');
      const activeContactCount = await tx.clientContact.count({ where: { clientId, active: true } });
      const isPrimary = body.isPrimary || activeContactCount === 0;
      if (isPrimary) await tx.clientContact.updateMany({ where: { clientId, active: true }, data: { isPrimary: false } });
      const created = await tx.clientContact.create({ data: {
        clientId,
        ...body,
        isPrimary,
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'CREATE_CLIENT_CONTACT',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ contactId: created.id }),
      } });
      return created;
    });

    return NextResponse.json({ success: true, contact });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    const errorMsg = err instanceof Error ? err.message : 'Chyba při vytváření kontaktu.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
