import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurveyPoint, upsertFieldSurveyParcel } from '@/lib/field-survey/data';
import { createParcelLookupProvider } from '@/lib/field-survey/parcel-lookup';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/**
 * POST /api/field-survey/[id]/points/[pointId]/parcel-lookup
 *
 * Zjistí parcelu z geodatového zdroje (ČÚZK RÚIAN nebo ManualProvider).
 * AI NESMÍ vymýšlet parcelní čísla – data musí pocházet z ParcelLookupProvider.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;

  const auth = await requireApiAccess('carriers', 'fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const point = await getFieldSurveyPoint(pointId);
  if (!point) return jsonError('NOT_FOUND', 'Průzkumný bod nebyl nalezen.', 404);

  const provider = createParcelLookupProvider();

  let result: Awaited<ReturnType<typeof provider.lookup>>;
  try {
    result = await provider.lookup(point.latitude, point.longitude);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Neznámá chyba';
    console.error('[field-survey/parcel-lookup] Provider selhal', { pointId, error: message });
    return jsonError('LOOKUP_FAILED', `Zjišťování parcely selhalo: ${message}`, 500);
  }

  // Uložíme výsledek (i negativní – pro audit)
  const parcel = await upsertFieldSurveyParcel(pointId, {
    parcelNumber: result.parcelNumber,
    cadastralArea: result.cadastralArea,
    municipality: result.municipality,
    source: result.source,
    sourceUrl: result.sourceUrl,
    confidence: result.confidence,
    rawData: result.rawData,
    verifiedByUserId: result.found ? auth.id : undefined,
  });

  console.info('[field-survey] Parcel lookup', {
    pointId, provider: provider.name, found: result.found,
    parcel: result.parcelNumber, orgId: organizationId,
  });

  return NextResponse.json({
    success: true,
    found: result.found,
    parcel,
    lookupResult: result,
    message: result.found
      ? `Parcela ${result.parcelNumber ?? ''} nalezena (${result.source}).`
      : (result.errorMessage ?? 'Parcela nebyla ověřena. Doplňte parcelní číslo ručně.'),
  });
}
