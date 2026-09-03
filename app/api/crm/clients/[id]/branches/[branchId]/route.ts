import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { CrmClientValidationError, parseBranchInput } from '@/lib/crm/client-policy';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, branchId } = await params;

  try {
    const body = parseBranchInput(await req.json().catch(() => null));

    const updated = await prisma.$transaction(async (tx) => {
      const branch = await tx.clientBranch.findFirst({ where: { id: branchId, clientId, active: true } });
      if (!branch) throw new Error('BRANCH_NOT_FOUND');
      if (body.contactPersonId && !await tx.clientContact.count({
        where: { id: body.contactPersonId, clientId, active: true },
      })) throw new Error('INVALID_CONTACT');
      const result = await tx.clientBranch.update({ where: { id: branchId }, data: body });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'UPDATE_CLIENT_BRANCH',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ branchId }),
      } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, branch: updated });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'BRANCH_NOT_FOUND') return NextResponse.json({ error: 'Pobočka nebyla nalezena.' }, { status: 404 });
    if (err instanceof Error && err.message === 'INVALID_CONTACT') return NextResponse.json({ error: 'Kontaktní osoba nepatří tomuto klientovi.' }, { status: 400 });
    console.error('CRM branch update failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Pobočku se nepodařilo upravit.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, branchId } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.clientBranch.updateMany({ where: { id: branchId, clientId, active: true }, data: { active: false } });
      if (result.count !== 1) throw new Error('BRANCH_NOT_FOUND');
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'ARCHIVE_CLIENT_BRANCH',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ branchId }),
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'BRANCH_NOT_FOUND') return NextResponse.json({ error: 'Pobočka nebyla nalezena.' }, { status: 404 });
    console.error('CRM branch archive failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Pobočku se nepodařilo archivovat.' }, { status: 500 });
  }
}
