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
      select: {
        id: true,
        offerType: true,
        isNoPriceConcept: true,
        navigation: { select: { id: true, proposalMode: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    }

    const currentlyWithoutPrices =
      existing.offerType === 'NAVIGATION' && existing.navigation
        ? existing.isNoPriceConcept || existing.navigation.proposalMode !== 'PRICED_QUOTE'
        : existing.isNoPriceConcept;

    const nextNoPriceConcept = !currentlyWithoutPrices;

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        isNoPriceConcept: nextNoPriceConcept,
        ...(existing.offerType === 'NAVIGATION' && existing.navigation
          ? {
              navigation: {
                update: {
                  proposalMode: nextNoPriceConcept ? 'LOCATION_SELECTION' : 'PRICED_QUOTE',
                },
              },
            }
          : {}),
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
