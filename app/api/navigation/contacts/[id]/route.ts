import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { updateNavigationContactPerson } from '@/lib/navigation/contract-service';
import { NavigationContractValidationError, parseNavigationContactInput } from '@/lib/navigation/contract-policy';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiAccess('navigationContacts');
    if (isApiDenied(user)) return user;
    const { id } = await params;
    const contact = await updateNavigationContactPerson(user, id, parseNavigationContactInput(await req.json().catch(() => null)));
    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    if (error instanceof NavigationContractValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Kontakt se nepodařilo změnit.', error);
    return NextResponse.json({ error: 'Kontakt se nepodařilo změnit.' }, { status: 500 });
  }
}
