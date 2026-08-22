import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { parseOpportunityFromAiInput } from '@/lib/opportunities/parser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const body = await request.json();
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : undefined;

    if (!input && !url) {
      return NextResponse.json({ error: 'Zadejte text zprávy nebo URL článku.' }, { status: 400 });
    }

    const parsed = await parseOpportunityFromAiInput(input || url || '', url);
    return NextResponse.json({ parsed });
  } catch (error) {
    console.error('Failed to parse AI opportunity input', error);
    return NextResponse.json({ error: 'Analýza podkladů se nepodařila.' }, { status: 500 });
  }
}
