import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import { buildRealizationContext } from '@/lib/ai-realization/realization-engine';
import { generateRealizationSummary } from '@/lib/ai-realization/realization-insights';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const profile = await getOrganizationRealizationProfile(auth.organizationId!);
    const context = await buildRealizationContext(id, auth, profile);

    if (!context) {
      return NextResponse.json({ error: 'Realizační zakázka nebyla nalezena.' }, { status: 404 });
    }

    const summaryResult = await generateRealizationSummary(context, auth);
    return NextResponse.json(summaryResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při generování AI shrnutí realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
