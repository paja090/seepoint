import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { backfillSemanticPreview, reviewSource } from '@/lib/opportunities/semantic-service';
import { OpportunityValidationError } from '@/lib/opportunities/policy';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;
  const cursor = new URL(request.url).searchParams.get('cursor');
  const items = await prisma.radarSignal.findMany({ where: { organizationId: user.organizationId, semanticDecision: 'POSSIBLE_DUPLICATE', ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 50 });
  const ids = items.flatMap(s => [s.candidateOpportunityId, s.canonicalOpportunityId]).filter((id): id is string => Boolean(id));
  const opportunities = await prisma.salesOpportunity.findMany({ where: { organizationId: user.organizationId, id: { in: ids } }, select: { id: true, title: true, companyName: true, city: true, semanticData: true, mergedIntoId: true } });
  return NextResponse.json({ items, opportunities, nextCursor: items.length === 50 ? items[49].id : null, canReview: ['ADMIN', 'MANAGER'].includes(user.role) });
}
export async function POST(request: Request) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) return NextResponse.json({ error: 'Zdroje může slučovat nebo oddělovat administrátor či manažer.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityDiscovery);
  if (limited) return limited;
  try {
    const body = await request.json();
    if (body.action === 'BACKFILL_PREVIEW') {
      if (body.cursor != null && (typeof body.cursor !== 'string' || body.cursor.length > 100)) throw new OpportunityValidationError('Neplatný kurzor.');
      return NextResponse.json(await backfillSemanticPreview(user.organizationId, user.id, body.cursor || undefined));
    }
    if (!['MERGE', 'KEEP_SEPARATE', 'DETACH'].includes(body.action) || typeof body.sourceId !== 'string' || body.sourceId.length > 100) throw new OpportunityValidationError('Neplatná akce nebo zdroj.');
    return NextResponse.json(await reviewSource(user.organizationId, user.id, body.sourceId, body.action));
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Radar semantic review failed', error);
    return NextResponse.json({ error: 'Kontrolu duplicit se nepodařilo dokončit.' }, { status: 500 });
  }
}
