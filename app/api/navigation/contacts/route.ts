import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createNavigationContactPerson, listNavigationContactPersons } from '@/lib/navigation/contract-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'Chybí clientId' }, { status: 400 });

    const contacts = await listNavigationContactPersons(clientId);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při načítání kontaktů' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const body = await req.json();
    const contact = await createNavigationContactPerson(body);
    return NextResponse.json({ success: true, contact });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při vytváření kontaktu' }, { status: 400 });
  }
}
