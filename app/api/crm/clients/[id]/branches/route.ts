import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmClientValidationError, parseBranchInput } from '@/lib/crm/client-policy';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId } = await params;

  try {
    const body = parseBranchInput(await req.json().catch(() => null));

    const branch = await prisma.$transaction(async (tx) => {
      const clientExists = await tx.client.count({ where: { id: clientId, active: true } });
      if (!clientExists) throw new Error('CLIENT_NOT_FOUND');
      if (body.contactPersonId) {
        const contactExists = await tx.clientContact.count({ where: { id: body.contactPersonId, clientId, active: true } });
        if (!contactExists) throw new Error('INVALID_CONTACT');
      }
      const created = await tx.clientBranch.create({ data: {
        clientId,
        name: body.name.trim(),
        code: body.code?.trim() || null,
        street: body.street?.trim() || null,
        city: body.city?.trim() || null,
        zip: body.zip?.trim() || null,
        country: body.country?.trim() || 'CZ',
        latitude: body.latitude,
        longitude: body.longitude,
        contactPersonId: body.contactPersonId || null,
        openingHoursNote: body.openingHoursNote?.trim() || null,
        note: body.note?.trim() || null,
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      await tx.crmAuditLog.create({ data: {
        userId: authResult.id, userEmail: authResult.email, action: 'CREATE_CLIENT_BRANCH',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ branchId: created.id }),
      } });
      return created;
    });

    return NextResponse.json({ success: true, branch });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    if (err instanceof Error && err.message === 'INVALID_CONTACT') return NextResponse.json({ error: 'Kontaktní osoba nepatří tomuto klientovi.' }, { status: 400 });
    const errorMsg = err instanceof Error ? err.message : 'Chyba při zakládání pobočky.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
