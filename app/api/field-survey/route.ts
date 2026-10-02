import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { createFieldSurvey, listFieldSurveys } from '@/lib/field-survey/data';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** GET /api/field-survey – seznam průzkumů tenantu */
export async function GET(req: Request) {
  const auth = await requireApiAccess('carriers', 'fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;

  const surveys = await listFieldSurveys({ status });
  return NextResponse.json({ success: true, surveys });
}

/** POST /api/field-survey – vytvoření průzkumné akce */
export async function POST(req: Request) {
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

  const { name, description } = body as { name?: string; description?: string };
  if (!name?.trim()) {
    return jsonError('NAME_REQUIRED', 'Název průzkumné akce je povinný.', 400);
  }
  if (name.trim().length > 200) {
    return jsonError('NAME_TOO_LONG', 'Název průzkumné akce může mít max. 200 znaků.', 400);
  }

  const survey = await createFieldSurvey({
    name: name.trim(),
    description: description?.trim(),
    createdByUserId: auth.id,
  });

  console.info('[field-survey] Vytvořena průzkumná akce', { surveyId: survey.id, orgId: organizationId, userId: auth.id });

  return NextResponse.json({ success: true, survey }, { status: 201 });
}
