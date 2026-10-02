import { NextResponse } from 'next/server';
import { canAccess } from '@/lib/rbac';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurveyPoint, convertSurveyPointToCarrier } from '@/lib/field-survey/data';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/**
 * POST /api/field-survey/[id]/points/[pointId]/convert-to-carrier
 *
 * Převede průzkumný bod na skutečný nosič.
 * - Pouze ADMIN nebo MANAGER
 * - Idempotentní – opakovaný request NEVYTVOŘÍ druhý nosič
 * - Musí být explicitní akce uživatele (ne automatická)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;

  const auth = await requireApiAccess('carriers', 'fieldSurvey');
  if (isApiDenied(auth)) return auth;

  // Konverzi smí provést pouze ADMIN nebo MANAGER
  if (!canAccess(auth.role, 'settings') && auth.role !== 'ADMIN' && auth.role !== 'MANAGER') {
    return jsonError('FORBIDDEN', 'Převod na nosič smí provést pouze ADMIN nebo MANAGER.', 403);
  }

  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const point = await getFieldSurveyPoint(pointId);
  if (!point) return jsonError('NOT_FOUND', 'Průzkumný bod nebyl nalezen.', 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Neplatný formát požadavku.', 400);
  }

  const { code, name, city, type, note } = body as {
    code?: string;
    name?: string;
    city?: string;
    type?: string;
    note?: string;
  };

  if (!code?.trim()) return jsonError('CODE_REQUIRED', 'Kód nosiče je povinný.', 400);
  if (!name?.trim()) return jsonError('NAME_REQUIRED', 'Název nosiče je povinný.', 400);
  if (!city?.trim()) return jsonError('CITY_REQUIRED', 'Město nosiče je povinné.', 400);

  const VALID_CARRIER_TYPES = new Set([
    'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN',
    'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'NAVIGATION', 'PROMO_TOWER',
    'PROMO_MINITOWER', 'OTHER',
  ]);
  const resolvedType = (type ?? 'BILLBOARD').toUpperCase();
  if (!VALID_CARRIER_TYPES.has(resolvedType)) {
    return jsonError('INVALID_TYPE', `Neplatný typ nosiče: ${resolvedType}.`, 400);
  }

  try {
    const { carrier, alreadyConverted } = await convertSurveyPointToCarrier(
      pointId,
      { code: code.trim(), name: name.trim(), city: city.trim(), type: resolvedType, note: note?.trim() },
      auth.id
    );

    console.info('[field-survey] Průzkumný bod převeden na nosič', {
      pointId, carrierId: carrier?.id, alreadyConverted, orgId: organizationId, userId: auth.id,
    });

    return NextResponse.json({
      success: true,
      carrier,
      alreadyConverted,
      message: alreadyConverted
        ? `Bod byl již dříve převeden na nosič ${carrier?.code ?? ''}.`
        : `Průzkumný bod byl úspěšně převeden na nosič ${carrier?.code ?? ''}.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('ACCESS_DENIED', 'Průzkumný bod nebyl nalezen nebo nemáte přístup.', 403);
    }
    console.error('[field-survey/convert-to-carrier] Chyba při převodu', error);
    return jsonError('CONVERSION_ERROR', 'Převod na nosič se nezdařil. Zkuste akci zopakovat.', 500);
  }
}
