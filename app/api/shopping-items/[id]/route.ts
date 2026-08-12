import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Chybí ID položky.' }, { status: 400 });

  try {
    await prisma.companyShoppingItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo smazat.' },
      { status: 500 }
    );
  }
}
