import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import {
  findDuplicateClientGroups,
  searchClientMergeCandidates,
  autoMergeAllHighConfidenceDuplicates,
} from '@/lib/crm/duplicates-service';
import { mergeDuplicateClients } from '@/lib/crm/merge-service';

export async function GET(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const excludeId = url.searchParams.get('excludeId');

  if (q && excludeId) {
    const candidates = await searchClientMergeCandidates(
      q,
      excludeId,
      user.organizationId ?? undefined
    );
    return NextResponse.json({ candidates });
  }

  const groups = await findDuplicateClientGroups(user.organizationId ?? undefined);
  const totalDuplicatesCount = groups.reduce((acc, g) => acc + g.duplicates.length, 0);

  return NextResponse.json({
    groups,
    totalDuplicatesCount,
    canAutoMergeCount: groups.filter((g) => g.canAutoMerge).reduce((acc, g) => acc + g.duplicates.length, 0),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Slučovat duplicitní klienty může pouze administrátor nebo manažer.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      targetClientId?: string;
      sourceClientId?: string;
    } | null;

    if (body?.action === 'auto_merge_all') {
      const summary = await autoMergeAllHighConfidenceDuplicates(
        user.id,
        user.email,
        user.organizationId ?? undefined
      );
      return NextResponse.json({ success: true, summary });
    }

    if (body?.action === 'merge_pair' || (body?.targetClientId && body?.sourceClientId)) {
      if (!body.targetClientId || !body.sourceClientId) {
        return NextResponse.json(
          { error: 'Cílový i zdrojový klient musí být zadáni.' },
          { status: 400 }
        );
      }

      const result = await mergeDuplicateClients(
        body.targetClientId,
        body.sourceClientId,
        user.id,
        user.email
      );

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Neznámá akce.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('CRM duplicate merge API failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chyba při slučování klientů.' },
      { status: 500 }
    );
  }
}
