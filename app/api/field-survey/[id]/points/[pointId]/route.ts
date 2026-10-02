import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurveyPoint, updateFieldSurveyPoint } from '@/lib/field-survey/data';
import type { FieldSurveySurfaceType, FieldSurveyPointStatus } from '@prisma/client';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** GET /api/field-survey/[id]/points/[pointId] – detail průzkumného bodu */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;
  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const point = await getFieldSurveyPoint(pointId);
  if (!point) return jsonError('NOT_FOUND', 'Průzkumný bod nebyl nalezen.', 404);

  return NextResponse.json({ success: true, point });
}

/** PATCH /api/field-survey/[id]/points/[pointId] – aktualizace bodu */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;
  const auth = await requireApiAccess('fieldSurvey');
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

  const { surfaceType, status, note, address } = body as {
    surfaceType?: string;
    status?: string;
    note?: string;
    address?: string;
  };

  const VALID_SURFACE_TYPES = new Set(['ACKO', 'TOWER', 'BANNER', 'PLOT', 'OTHER']);
  const VALID_STATUSES = new Set(['NEW', 'REVIEWED', 'PARCEL_FOUND', 'OWNER_FOUND', 'CONTACT_FOUND', 'INTERESTING', 'REJECTED', 'CONVERTED']);

  if (surfaceType && !VALID_SURFACE_TYPES.has(surfaceType.toUpperCase())) {
    return jsonError('INVALID_SURFACE_TYPE', 'Neplatný typ plochy.', 400);
  }
  if (status && !VALID_STATUSES.has(status.toUpperCase())) {
    return jsonError('INVALID_STATUS', 'Neplatný stav průzkumného bodu.', 400);
  }

  try {
    const updated = await updateFieldSurveyPoint(pointId, {
      surfaceType: surfaceType ? (surfaceType.toUpperCase() as FieldSurveySurfaceType) : undefined,
      status: status ? (status.toUpperCase() as FieldSurveyPointStatus) : undefined,
      note,
      address,
    });
    return NextResponse.json({ success: true, point: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('ACCESS_DENIED', 'Průzkumný bod nebyl nalezen nebo nemáte přístup.', 403);
    }
    console.error('[field-survey/points/[pointId]] Chyba při aktualizaci bodu', error);
    return jsonError('DATABASE_ERROR', 'Průzkumný bod se nepodařilo aktualizovat.', 500);
  }
}
