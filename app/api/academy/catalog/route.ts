import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getAcademyCatalog, isAcademySchemaMissing } from '@/lib/academy/service';
export async function GET(request: Request) {
  const actor = await requireApiAccess('academy');
  if (isApiDenied(actor)) return actor;
  const url = new URL(request.url);
  try { return NextResponse.json({ lessons: await getAcademyCatalog(actor, { query: url.searchParams.get('q') || '', preview: url.searchParams.get('preview') === '1' }) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { if (isAcademySchemaMissing(error)) return NextResponse.json({ error: 'Akademie ještě není připravena. Kontaktujte správce.' }, { status: 503 }); throw error; }
}
