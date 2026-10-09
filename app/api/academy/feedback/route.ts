import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createAcademyFeedback, isAcademySchemaMissing } from '@/lib/academy/service';
import { parseAcademyFeedback } from '@/lib/academy/policy';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
export async function POST(request: Request) {
  const actor = await requireApiAccess('academy');
  if (isApiDenied(actor)) return actor;
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Neplatný původ požadavku.' }, { status: 403 });
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${actor.organizationId}:${actor.id}`), { scope: 'academy:feedback', windowMs: 60_000, limits: { ip: 40, identity: 10, pair: 10 } });
  if (limited) return limited;
  let input;
  try { const body = await request.text(); if (body.length > 12000) throw new Error('Příliš dlouhý podnět.'); input = parseAcademyFeedback(JSON.parse(body)); }
  catch { return NextResponse.json({ error: 'Vyberte důvod a napište 5 až 2000 znaků.' }, { status: 400 }); }
  try {
    const result = await createAcademyFeedback(actor, input);
    return result ? NextResponse.json(result, { status: 201 }) : NextResponse.json({ error: 'Lekce není dostupná.' }, { status: 404 });
  } catch (error) {
    if (isAcademySchemaMissing(error)) return NextResponse.json({ error: 'Akademie ještě není připravena.' }, { status: 503 });
    if (error instanceof Error && error.message === 'Krok v této revizi neexistuje.') return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
