import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { generateFollowUpDraft } from '@/lib/ai-crm/follow-up-draft-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const user = authResult;

  try {
    const body = (await req.json().catch(() => null)) as { offerId?: string } | null;
    const offerId = body?.offerId?.trim();

    if (!offerId) {
      return NextResponse.json({ error: 'Chybí parametr offerId.' }, { status: 400 });
    }

    const draft = await generateFollowUpDraft(offerId, user.organizationId);
    if (!draft) {
      return NextResponse.json(
        { error: 'Nabídka nebyla nalezena nebo k ní chybí klient.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      draft,
    });
  } catch (error) {
    console.error('Follow-up draft API error:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se vygenerovat draft follow-upu.' },
      { status: 500 }
    );
  }
}
