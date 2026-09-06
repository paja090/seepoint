import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export const runtime = 'nodejs';

const ALLOWED_VERDICTS = new Set([
  'RELEVANT',
  'IRRELEVANT',
  'BAD_GEO',
  'BAD_TIMING',
  'ALREADY_CLIENT',
]);

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  const { id } = await props.params;
  const opp = await prisma.salesOpportunity.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });

  if (!opp) {
    return NextResponse.json({ error: 'Příležitost nebyla nalezena.' }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const verdict = String(body.verdict || '').trim().toUpperCase();
    if (!ALLOWED_VERDICTS.has(verdict)) {
      return NextResponse.json({ error: 'Neplatný typ zpětné vazby.' }, { status: 400 });
    }

    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : null;

    const feedback = await prisma.radarFeedback.create({
      data: {
        organizationId: user.organizationId,
        opportunityId: opp.id,
        userId: user.id,
        verdict,
        comment,
      },
    });

    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    console.error('Failed to submit radar feedback', err);
    return NextResponse.json({ error: 'Chyba při ukládání zpětné vazby.' }, { status: 500 });
  }
}
