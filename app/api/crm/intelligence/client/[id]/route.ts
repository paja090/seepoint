import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getClient360 } from '@/lib/ai-crm/client-360-service';
import { getClientTimeline } from '@/lib/ai-crm/crm-timeline-service';
import { generateClientAiExplanation } from '@/lib/ai-crm/crm-ai-explainer';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const user = authResult;
  const { id } = await params;

  try {
    const client360 = await getClient360(id, user.organizationId);
    if (!client360) {
      return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 });
    }

    const [timeline, aiExplanation] = await Promise.all([
      getClientTimeline(id, user.organizationId),
      generateClientAiExplanation(client360, user.id),
    ]);

    return NextResponse.json({
      ok: true,
      client360: {
        ...client360,
        intelligence: {
          ...client360.intelligence,
          aiExplanation,
        },
      },
      timeline,
    });
  } catch (error) {
    console.error('Client 360 API error:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst Client 360 data.' },
      { status: 500 }
    );
  }
}
