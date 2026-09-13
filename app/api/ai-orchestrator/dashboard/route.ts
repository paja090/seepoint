import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getCommercialCenterData } from '@/lib/ai-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('commercial'); if (isApiDenied(auth)) return auth;

  try {
    const data = await getCommercialCenterData(auth.organizationId!);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[ai-orchestrator/dashboard] Chyba:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Načtení dat obchodního centra selhalo.' },
      { status: 500 }
    );
  }
}
