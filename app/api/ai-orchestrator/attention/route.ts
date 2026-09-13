import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getCommercialAttentionItems } from '@/lib/ai-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('commercial'); if (isApiDenied(auth)) return auth;

  try {
    const items = await getCommercialAttentionItems(auth.organizationId!);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[ai-orchestrator/attention] Chyba:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Načtení položek pozornosti selhalo.' },
      { status: 500 }
    );
  }
}
