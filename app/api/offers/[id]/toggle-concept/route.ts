import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('offers');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const existing = await prisma.offer.findUnique({
      where: { id },
      select: { id: true, isNoPriceConcept: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        isNoPriceConcept: !existing.isNoPriceConcept,
        events: {
          create: {
            type: 'UPDATED',
            actorUserId: user.id,
            actorName: user.name,
          },
        },
      },
      select: { id: true, isNoPriceConcept: true },
    });

    return NextResponse.json({
      success: true,
      isNoPriceConcept: updated.isNoPriceConcept,
    });
  } catch (error) {
    console.error('Toggle concept error', error);
    return NextResponse.json({ error: 'Chyba při změně režimu nabídky.' }, { status: 500 });
  }
}
