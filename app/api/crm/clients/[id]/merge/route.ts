import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { mergeDuplicateClients } from '@/lib/crm/merge-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Klienty může slučovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const { id: targetClientId } = await params;

  try {
    const body = await req.json();
    if (!body.sourceClientId) {
      return NextResponse.json({ error: 'Zdrojový klient k sloučení nebyl zadán.' }, { status: 400 });
    }

    const result = await mergeDuplicateClients(
      targetClientId,
      body.sourceClientId,
      user.id,
      user.email
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Chyba při slučování klientů.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
