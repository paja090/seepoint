import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getOrganizationRadarProfile, saveOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const profile = await getOrganizationRadarProfile(user.organizationId);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('Failed to get radar profile', err);
    return NextResponse.json({ error: 'Chyba při načítání profilu radaru.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Nastavení profilu radaru může měnit pouze administrátor nebo manažer.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await saveOrganizationRadarProfile(user.organizationId, {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      targetRegions: Array.isArray(body.targetRegions) ? body.targetRegions : undefined,
      targetCities: Array.isArray(body.targetCities) ? body.targetCities : undefined,
      focusEventTypes: Array.isArray(body.focusEventTypes) ? body.focusEventTypes : undefined,
      preferredMediaTypes: Array.isArray(body.preferredMediaTypes) ? body.preferredMediaTypes : undefined,
      customKeywords: Array.isArray(body.customKeywords) ? body.customKeywords : undefined,
      customRssSources: Array.isArray(body.customRssSources) ? body.customRssSources : undefined,
      minScoreThreshold: typeof body.minScoreThreshold === 'number' ? body.minScoreThreshold : undefined,
      scoringWeights: body.scoringWeights && typeof body.scoringWeights === 'object' ? body.scoringWeights : undefined,
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    console.error('Failed to update radar profile', err);
    return NextResponse.json({ error: 'Chyba při ukládání profilu radaru.' }, { status: 500 });
  }
}
