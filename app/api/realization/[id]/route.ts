import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { getOrganizationRealizationProfile } from '@/lib/ai-realization/profile';
import {
  buildRealizationContext,
  determineRealizationNextBestActions,
} from '@/lib/ai-realization/realization-engine';
import { buildDeterministicRealizationInsights } from '@/lib/ai-realization/realization-insights';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const nextBestActions = determineRealizationNextBestActions(context);
    const insights = buildDeterministicRealizationInsights(context);

    return NextResponse.json({
      context,
      nextBestActions,
      insights,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při načítání detailu realizace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
