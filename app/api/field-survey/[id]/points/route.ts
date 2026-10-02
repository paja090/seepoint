import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import {
  createFieldSurveyPoint,
  listFieldSurveyPoints,
} from '@/lib/field-survey/data';
import type { FieldSurveySurfaceType, FieldSurveyGpsSource } from '@prisma/client';
import { parseRequiredCoordinates } from '@/lib/mobile-photo-upload';

export const runtime = 'nodejs';

const VALID_SURFACE_TYPES = new Set<string>(['ACKO', 'TOWER', 'BANNER', 'PLOT', 'OTHER']);

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** GET /api/field-survey/[id]/points – seznam bodů průzkumu s filtry */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const auth = await requireApiAccess('carriers', 'fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const surfaceType = url.searchParams.get('surfaceType') ?? undefined;
  const createdByUserId = url.searchParams.get('createdByUserId') ?? undefined;
  const dateFrom = url.searchParams.get('dateFrom') ? new Date(url.searchParams.get('dateFrom')!) : undefined;
  const dateTo = url.searchParams.get('dateTo') ? new Date(url.searchParams.get('dateTo')!) : undefined;
  const hasParcel = url.searchParams.has('hasParcel') ? url.searchParams.get('hasParcel') === 'true' : undefined;
  const hasContact = url.searchParams.has('hasContact') ? url.searchParams.get('hasContact') === 'true' : undefined;
  const hasAiAnalysis = url.searchParams.has('hasAiAnalysis') ? url.searchParams.get('hasAiAnalysis') === 'true' : undefined;

  const points = await listFieldSurveyPoints({
    surveyId,
    status: status as Parameters<typeof listFieldSurveyPoints>[0]['status'],
    surfaceType: surfaceType as Parameters<typeof listFieldSurveyPoints>[0]['surfaceType'],
    createdByUserId,
    dateFrom,
    dateTo,
    hasParcel,
    hasContact,
    hasAiAnalysis,
  });

  return NextResponse.json({ success: true, points });
}

/** POST /api/field-survey/[id]/points – vytvoří nový průzkumný bod */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const auth = await requireApiAccess('carriers', 'fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Neplatný formát požadavku.', 400);
  }

  const {
    surfaceType,
    latitude,
    longitude,
    gpsAccuracyMeters,
    gpsSource,
    capturedAt,
    address,
    note,
  } = body as {
    surfaceType?: string;
    latitude?: unknown;
    longitude?: unknown;
    gpsAccuracyMeters?: unknown;
    gpsSource?: string;
    capturedAt?: string;
    address?: string;
    note?: string;
  };

  // Validace typu plochy
  const resolvedSurfaceType = (surfaceType ?? 'OTHER').toUpperCase();
  if (!VALID_SURFACE_TYPES.has(resolvedSurfaceType)) {
    return jsonError('INVALID_SURFACE_TYPE', `Neplatný typ plochy: ${resolvedSurfaceType}. Povolené hodnoty: ${[...VALID_SURFACE_TYPES].join(', ')}.`, 400);
  }

  // Validace GPS – využíváme existující helper z mobile-photo-upload
  const coords = parseRequiredCoordinates(
    typeof latitude === 'number' ? String(latitude) : (latitude as null),
    typeof longitude === 'number' ? String(longitude) : (longitude as null)
  );
  if (!coords) {
    return jsonError('GPS_REQUIRED', 'Průzkumný bod musí mít platnou GPS polohu.', 400);
  }

  const accuracy = typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters) && gpsAccuracyMeters >= 0
    ? gpsAccuracyMeters : undefined;

  // Upozornění na nízkou přesnost GPS (>50m) – není blokující, jen vrátíme v odpovědi
  const gpsWarning = accuracy !== undefined && accuracy > 50
    ? `GPS přesnost je nízká (±${Math.round(accuracy)} m). Doporučujeme fotografovat ve venkovním prostoru.`
    : null;

  const validGpsSource = (['DEVICE', 'EXIF', 'MANUAL'] as FieldSurveyGpsSource[]).includes(gpsSource as FieldSurveyGpsSource)
    ? (gpsSource as FieldSurveyGpsSource) : 'DEVICE';

  let point;
  try {
    point = await createFieldSurveyPoint({
      surveyId,
      surfaceType: resolvedSurfaceType as FieldSurveySurfaceType,
      latitude: coords.lat,
      longitude: coords.lng,
      gpsAccuracyMeters: accuracy,
      gpsSource: validGpsSource,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      address: address?.trim().slice(0, 500),
      note: note?.trim().slice(0, 2000),
      createdByUserId: auth.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('ACCESS_DENIED', 'Průzkumná akce nebyla nalezena nebo nemáte přístup.', 403);
    }
    console.error('[field-survey/points] Chyba při vytváření bodu', error);
    return jsonError('DATABASE_ERROR', 'Průzkumný bod se nepodařilo uložit. Zkuste akci zopakovat.', 500);
  }

  console.info('[field-survey] Vytvořen průzkumný bod', {
    pointId: point.id, surveyId, orgId: organizationId, userId: auth.id,
    lat: coords.lat, lng: coords.lng, accuracy,
  });

  return NextResponse.json({ success: true, point, gpsWarning }, { status: 201 });
}
