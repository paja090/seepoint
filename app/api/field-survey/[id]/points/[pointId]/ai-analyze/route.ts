import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurveyPoint, upsertFieldSurveyAiAnalysis } from '@/lib/field-survey/data';
import { runFieldSurveyAiAnalysis } from '@/lib/field-survey/ai-analysis';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/**
 * POST /api/field-survey/[id]/points/[pointId]/ai-analyze
 * Spustí AI analýzu pro první dostupnou fotografii průzkumného bodu.
 */
export async function POST(
  req: Request,
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

  // Zkontrolujeme, zda bod má fotografii
  const firstPhoto = point.photos[0];
  if (!firstPhoto) {
    return jsonError('NO_PHOTO', 'Průzkumný bod nemá žádnou fotografii pro AI analýzu.', 400);
  }

  // Nastavíme status ANALYZING
  await upsertFieldSurveyAiAnalysis(pointId, {
    status: 'ANALYZING',
  });

  try {
    const analysis = await runFieldSurveyAiAnalysis(pointId, firstPhoto);
    return NextResponse.json({
      success: true,
      analysis,
      message: analysis.status === 'DONE'
        ? 'AI analýza byla úspěšně dokončena.'
        : `AI analýza skončila se stavem: ${analysis.status}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Neznámá chyba AI';
    await upsertFieldSurveyAiAnalysis(pointId, {
      status: 'FAILED',
      errorMessage: message,
    });
    return jsonError('AI_FAILED', `AI analýza selhala: ${message}`, 500);
  }
}

/**
 * PATCH /api/field-survey/[id]/points/[pointId]/ai-analyze
 * Potvrzení nebo ruční úprava AI návrhu pracovníkem.
 */
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

  const {
    suggestedType,
    isUsable,
    locationDesc,
    visibility,
    orientation,
    surroundings,
    obstacles,
    placementChar,
  } = body as {
    suggestedType?: string;
    isUsable?: boolean;
    locationDesc?: string;
    visibility?: string;
    orientation?: string;
    surroundings?: string;
    obstacles?: string;
    placementChar?: string;
  };

  const updated = await upsertFieldSurveyAiAnalysis(pointId, {
    status: 'DONE',
    suggestedType,
    isUsable,
    locationDesc,
    visibility,
    orientation,
    surroundings,
    obstacles,
    placementChar,
    confirmedAt: new Date(),
    confirmedByUserId: auth.id,
  });

  return NextResponse.json({
    success: true,
    analysis: updated,
    message: 'AI parametry byly potvrzeny pracovníkem.',
  });
}
