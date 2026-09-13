import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { handoffAcceptedOfferToRealization, RealizationHandoffError } from '@/lib/ai-realization/handoff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers', 'work');
  if (isApiDenied(auth)) return auth;

  try {
    const body = (await request.json().catch(() => ({}))) as { offerId?: string };
    const offerId = typeof body?.offerId === 'string' ? body.offerId.trim() : '';

    if (!offerId) {
      return NextResponse.json({ error: 'ID nabídky (offerId) je povinné.' }, { status: 400 });
    }

    const context = await handoffAcceptedOfferToRealization(offerId, auth);
    return NextResponse.json({ success: true, realizationContext: context });
  } catch (error) {
    if (error instanceof RealizationHandoffError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Chyba při předání nabídky do realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
