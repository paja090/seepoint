import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { CrmClientValidationError, parseContactInput } from '@/lib/crm/client-policy';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, contactId } = await params;

  try {
    const body = parseContactInput(await req.json().catch(() => null));

    const updated = await prisma.$transaction(async (tx) => {
      const contact = await tx.clientContact.findFirst({
        where: { id: contactId, clientId, active: true },
      });
      if (!contact) throw new Error('CONTACT_NOT_FOUND');

      if (body.isPrimary) {
        await tx.clientContact.updateMany({ where: { clientId, active: true }, data: { isPrimary: false } });
      }

      const result = await tx.clientContact.update({
        where: { id: contactId },
        data: body,
      });
      if (contact.isPrimary && !result.isPrimary) {
        const replacement = await tx.clientContact.findFirst({
          where: { clientId, active: true, id: { not: contactId } }, orderBy: { createdAt: 'asc' }, select: { id: true },
        });
        if (replacement) await tx.clientContact.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      }
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'UPDATE_CLIENT_CONTACT',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ contactId }),
      } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, contact: updated });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Kontakt nenalezen.' }, { status: 404 });
    }
    console.error('CRM contact update failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Kontakt se nepodařilo upravit.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, contactId } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const contact = await tx.clientContact.findFirst({ where: { id: contactId, clientId, active: true } });
      if (!contact) throw new Error('CONTACT_NOT_FOUND');
      await tx.clientContact.update({ where: { id: contactId }, data: { active: false, isPrimary: false } });
      if (contact.isPrimary) {
        const replacement = await tx.clientContact.findFirst({
          where: { clientId, active: true, id: { not: contactId } }, orderBy: { createdAt: 'asc' }, select: { id: true },
        });
        if (replacement) await tx.clientContact.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      }
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'ARCHIVE_CLIENT_CONTACT',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ contactId }),
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') return NextResponse.json({ error: 'Kontakt nenalezen.' }, { status: 404 });
    console.error('CRM contact archive failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Kontakt se nepodařilo archivovat.' }, { status: 500 });
  }
}
