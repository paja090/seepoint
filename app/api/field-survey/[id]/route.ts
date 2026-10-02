import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurvey, updateFieldSurvey } from '@/lib/field-survey/data';
import type { FieldSurveyStatus } from '@prisma/client';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** GET /api/field-survey/[id] – detail průzkumné akce */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const survey = await getFieldSurvey(id);
  if (!survey) return jsonError('NOT_FOUND', 'Průzkumná akce nebyla nalezena.', 404);

  return NextResponse.json({ success: true, survey });
}

/** PATCH /api/field-survey/[id] – úprava průzkumné akce */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { name, description, status } = body as {
    name?: string;
    description?: string;
    status?: string;
  };

  const VALID_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'ARCHIVED']);
  if (status && !VALID_STATUSES.has(status.toUpperCase())) {
    return jsonError('INVALID_STATUS', 'Neplatný stav průzkumu.', 400);
  }

  try {
    const updated = await updateFieldSurvey(id, {
      name,
      description,
      status: status ? (status.toUpperCase() as FieldSurveyStatus) : undefined,
    });
    return NextResponse.json({ success: true, survey: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('ACCESS_DENIED', 'Průzkumná akce nebyla nalezena nebo nemáte přístup.', 403);
    }
    return jsonError('DATABASE_ERROR', 'Průzkumnou akci se nepodařilo aktualizovat.', 500);
  }
}
