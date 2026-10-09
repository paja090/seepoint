import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { canManageAcademy } from '@/lib/academy/policy';
import { bootstrapAcademyPilots, isAcademySchemaMissing } from '@/lib/academy/service';
export async function POST(request: Request) {
  const actor = await requireApiAccess('academy');
  if (isApiDenied(actor)) return actor;
  if (!canManageAcademy(actor) || request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  try { return NextResponse.json(await bootstrapAcademyPilots(actor)); }
  catch (error) { if (isAcademySchemaMissing(error)) return NextResponse.json({ error: 'Nejprve musí být připravena databáze Akademie.' }, { status: 503 }); throw error; }
}
