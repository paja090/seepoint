import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { mergeDuplicateClients } from '@/lib/crm/merge-service';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Klienty může slučovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const { id: targetClientId } = await params;

  try {
    const body = await req.json().catch(() => null) as { sourceClientId?: unknown } | null;
    if (!body || typeof body.sourceClientId !== 'string' || !body.sourceClientId.trim() || body.sourceClientId.length > 64) {
      return NextResponse.json({ error: 'Zdrojový klient k sloučení nebyl zadán.' }, { status: 400 });
    }

    const result = await mergeDuplicateClients(
      targetClientId,
      body.sourceClientId.trim(),
      user.id,
      user.email
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Nelze sloučit klienta sám se sebou.') return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Cílový nebo zdrojový aktivní klient nebyl nalezen.' }, { status: 404 });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return NextResponse.json({ error: 'Klient byl mezitím změněn. Obnovte stránku a zkuste sloučení znovu.' }, { status: 409 });
    }
    console.error('CRM client merge failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Klienty se nepodařilo sloučit.' }, { status: 500 });
  }
}
