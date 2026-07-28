import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createNavigationContract, listNavigationContracts } from '@/lib/navigation/contract-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || undefined;
    const status = searchParams.get('status') || undefined;
    const query = searchParams.get('query') || undefined;

    const contracts = await listNavigationContracts(userOrRes, { clientId, status, query });
    return NextResponse.json({ success: true, contracts });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při načítání smluv' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userOrRes = await requireApiAccess('navigationProjects');
    if (isApiDenied(userOrRes)) return userOrRes;

    const body = await req.json();
    const contract = await createNavigationContract(userOrRes, body);
    return NextResponse.json({ success: true, contract });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Chyba při vytváření smlouvy' }, { status: 400 });
  }
}
