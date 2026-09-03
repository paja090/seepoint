import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { OpportunityValidationError } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const user = await requireApiAccess('clients');
    if (isApiDenied(user)) return user;
    const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.opportunityAi);
    if (limited) return limited;

  try {
    const body = await request.json();
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : undefined;

    if (!input && !url) {
      return NextResponse.json({ error: 'Zadejte text zprávy nebo URL článku.' }, { status: 400 });
    }
    if (input.length > 10_000) return NextResponse.json({ error: 'Text podkladu je příliš dlouhý.' }, { status: 413 });
    if (url && url.length > 2_000) return NextResponse.json({ error: 'URL je příliš dlouhá.' }, { status: 400 });

    const parsed = await parseOpportunityFromAiInput(input || url || '', url);
    return NextResponse.json({ parsed });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Failed to parse AI opportunity input', error);
    return NextResponse.json({ error: 'Analýza podkladů se nepodařila.' }, { status: 500 });
  }
}
