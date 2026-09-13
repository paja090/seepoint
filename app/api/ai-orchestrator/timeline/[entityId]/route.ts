import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { buildCommercialTimeline } from '@/lib/ai-orchestrator';

export const dynamic = 'force-dynamic';

const VALID_ENTITY_TYPES = ['AiInboxMessage', 'Offer', 'CrmOrder', 'SalesOpportunity'] as const;
type EntityType = typeof VALID_ENTITY_TYPES[number];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const auth = await requireApiAccess('commercial'); if (isApiDenied(auth)) return auth;

  const { entityId } = await params;

  const { searchParams } = new URL(request.url);
  const entityType = (searchParams.get('entityType') ?? 'Offer') as EntityType;

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: 'Neplatný typ entity.' }, { status: 400 });
  }

  try {
    const entries = await buildCommercialTimeline(auth.organizationId!, entityId, entityType);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[ai-orchestrator/timeline] Chyba:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Načtení timeline selhalo.' },
      { status: 500 }
    );
  }
}
