import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { orchestrateMailboxToOffer, orchestrateOfferAccepted } from '@/lib/ai-orchestrator';

export const dynamic = 'force-dynamic';

type RunBody = {
  triggerType: 'MAILBOX' | 'OFFER_ACCEPTED';
  entityId: string;
};

export async function POST(request: Request) {
  const auth = await requireApiAccess('commercial'); if (isApiDenied(auth)) return auth;

  let body: RunBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neplatný formát požadavku.' }, { status: 400 });
  }

  const { triggerType, entityId } = body;

  if (!triggerType || !entityId) {
    return NextResponse.json({ error: 'Parametry triggerType a entityId jsou povinné.' }, { status: 400 });
  }

  if (triggerType !== 'MAILBOX' && triggerType !== 'OFFER_ACCEPTED') {
    return NextResponse.json({ error: 'Neplatný typ triggeru.' }, { status: 400 });
  }

  try {
    const run = triggerType === 'MAILBOX'
      ? await orchestrateMailboxToOffer(entityId, auth)
      : await orchestrateOfferAccepted(entityId, auth);

    return NextResponse.json(run);
  } catch (error) {
    console.error('[ai-orchestrator/run] Chyba při orchestraci:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Orchestrace selhala.' },
      { status: 500 }
    );
  }
}
