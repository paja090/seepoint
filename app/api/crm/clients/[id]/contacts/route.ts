import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId } = await params;

  try {
    const body = await req.json();
    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ error: 'Jméno a příjmení kontaktní osoby jsou povinná.' }, { status: 400 });
    }

    const contact = await prisma.$transaction(async (tx) => {
      const clientExists = await tx.client.count({ where: { id: clientId, active: true } });
      if (!clientExists) throw new Error('CLIENT_NOT_FOUND');
      if (body.isPrimary) await tx.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
      const created = await tx.clientContact.create({ data: {
        clientId,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        title: body.title?.trim() || null,
        department: body.department?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        note: body.note?.trim() || null,
        preferredCommunication: body.preferredCommunication || 'EMAIL',
        isPrimary: Boolean(body.isPrimary),
        isCommercial: body.isCommercial !== undefined ? Boolean(body.isCommercial) : true,
        isRealization: Boolean(body.isRealization),
        isBilling: Boolean(body.isBilling),
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      return created;
    });

    return NextResponse.json({ success: true, contact });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    const errorMsg = err instanceof Error ? err.message : 'Chyba při vytváření kontaktu.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
