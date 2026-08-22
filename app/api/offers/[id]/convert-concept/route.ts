import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('offers');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const offer = await prisma.offer.findUnique({ where: { id } });
    if (!offer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: {
        isNoPriceConcept: false,
      },
    });

    await prisma.offerEvent.create({
      data: {
        offerId: id,
        type: 'UPDATED',
        actorUserId: user.id,
        actorName: user.name,
        message: 'Koncept kampaně byl 1-klikem převeden na standardní cenovou nabídku.',
        metadata: { event: 'CONVERT_NO_PRICE_CONCEPT_TO_PRICED_PROPOSAL' },
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Failed to convert concept to priced proposal', error);
    return NextResponse.json({ error: 'Převod se nepodařil.' }, { status: 500 });
  }
}
