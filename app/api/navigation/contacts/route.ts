import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createNavigationContactPerson, listNavigationContactPersons } from '@/lib/navigation/contract-service';
import { NavigationContractValidationError, parseNavigationContactFilters, parseNavigationContactInput } from '@/lib/navigation/contract-policy';

export const dynamic = 'force-dynamic';

function failure(error: unknown, fallback: string) {
  if (error instanceof NavigationContractValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const user = await requireApiAccess('navigationContacts');
    if (isApiDenied(user)) return user;
    const result = await listNavigationContactPersons(user, parseNavigationContactFilters(new URL(req.url).searchParams));
    return NextResponse.json({ success: true, contacts: result.items, total: result.total });
  } catch (error: unknown) {
    return failure(error, 'Kontakty se nepodařilo načíst.');
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireApiAccess('navigationContacts');
    if (isApiDenied(user)) return user;
    const data = parseNavigationContactInput(await req.json().catch(() => null));
    const contact = await createNavigationContactPerson(user, data);
    return NextResponse.json({ success: true, contact }, { status: 201 });
  } catch (error: unknown) {
    return failure(error, 'Kontakt se nepodařilo vytvořit.');
  }
}
