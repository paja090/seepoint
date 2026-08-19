import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, contactId } = await params;

  try {
    const body = await req.json();
    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ error: 'Jméno a příjmení kontaktní osoby jsou povinná.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const contact = await tx.clientContact.findFirst({
        where: { id: contactId, clientId, active: true },
      });
      if (!contact) throw new Error('CONTACT_NOT_FOUND');

      if (body.isPrimary && !contact.isPrimary) {
        await tx.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
      }

      return await tx.clientContact.update({
        where: { id: contactId },
        data: {
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          title: body.title !== undefined ? (body.title?.trim() || null) : contact.title,
          department: body.department !== undefined ? (body.department?.trim() || null) : contact.department,
          email: body.email !== undefined ? (body.email?.trim() || null) : contact.email,
          phone: body.phone !== undefined ? (body.phone?.trim() || null) : contact.phone,
          note: body.note !== undefined ? (body.note?.trim() || null) : contact.note,
          preferredCommunication: body.preferredCommunication || contact.preferredCommunication,
          isPrimary: body.isPrimary !== undefined ? Boolean(body.isPrimary) : contact.isPrimary,
          isCommercial: body.isCommercial !== undefined ? Boolean(body.isCommercial) : contact.isCommercial,
          isRealization: body.isRealization !== undefined ? Boolean(body.isRealization) : contact.isRealization,
          isBilling: body.isBilling !== undefined ? Boolean(body.isBilling) : contact.isBilling,
        },
      });
    });

    return NextResponse.json({ success: true, contact: updated });
  } catch (err: any) {
    if (err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Kontakt nenalezen.' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Chyba při úpravě kontaktu.' }, { status: 500 });
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
    await prisma.clientContact.delete({
      where: { id: contactId, clientId },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při mazání kontaktu.' }, { status: 500 });
  }
}
