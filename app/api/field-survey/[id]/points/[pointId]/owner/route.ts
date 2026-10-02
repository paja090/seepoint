import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { upsertFieldSurveyOwner } from '@/lib/field-survey/data';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** PUT /api/field-survey/[id]/points/[pointId]/owner */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;
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

  const { ownerName, ownerType, source, note } = body as {
    ownerName?: string;
    ownerType?: string;
    source?: string;
    note?: string;
  };

  try {
    const owner = await upsertFieldSurveyOwner(pointId, {
      ownerName,
      ownerType,
      source,
      note,
      verifiedByUserId: auth.id,
    });
    return NextResponse.json({ success: true, owner });
  } catch {
    return jsonError('DATABASE_ERROR', 'Vlastníka se nepodařilo uložit.', 500);
  }
}
