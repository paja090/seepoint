import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getCarrierHistoryTimeline, logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const carrierId = (await params).id;
    const history = await getCarrierHistoryTimeline(carrierId);
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při načítání historie nosiče' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const carrierId = (await params).id;
    const body = await req.json();

    const historyItem = await logCarrierHistoryEvent({
      carrierId,
      surfaceId: body.surfaceId,
      eventType: body.eventType,
      title: body.title,
      description: body.description,
      performedBy: userOrRes.name || 'Technik',
      performedAt: body.performedAt,
      clientId: body.clientId,
      clientName: body.clientName,
      photoUrl: body.photoUrl,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, historyItem });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při zápisu do historie nosiče' }, { status: 400 });
  }
}
