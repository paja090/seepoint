import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { id: clientId, branchId } = await params;

  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Název pobočky je povinný.' }, { status: 400 });
    }

    const updated = await prisma.clientBranch.update({
      where: { id: branchId, clientId },
      data: {
        name: body.name.trim(),
        code: body.code !== undefined ? (body.code?.trim() || null) : undefined,
        street: body.street !== undefined ? (body.street?.trim() || null) : undefined,
        city: body.city !== undefined ? (body.city?.trim() || null) : undefined,
        zip: body.zip !== undefined ? (body.zip?.trim() || null) : undefined,
        country: body.country !== undefined ? (body.country?.trim() || 'CZ') : undefined,
        note: body.note !== undefined ? (body.note?.trim() || null) : undefined,
      },
    });

    return NextResponse.json({ success: true, branch: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při úpravě pobočky.' }, { status: 500 });
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
    await prisma.clientBranch.delete({
      where: { id: branchId, clientId },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při mazání pobočky.' }, { status: 500 });
  }
}
