import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { upsertFieldSurveyContact } from '@/lib/field-survey/data';
import type { FieldSurveyContactVerification } from '@prisma/client';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/** PUT /api/field-survey/[id]/points/[pointId]/contact */
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

  const { company, contactPerson, phone, email, website, note, verificationStatus } = body as {
    company?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;
    note?: string;
    verificationStatus?: string;
  };

  const VALID_STATUSES = new Set(['VERIFIED', 'UNVERIFIED', 'NOT_FOUND']);
  const status = verificationStatus && VALID_STATUSES.has(verificationStatus)
    ? (verificationStatus as FieldSurveyContactVerification)
    : undefined;

  try {
    const contact = await upsertFieldSurveyContact(pointId, {
      company,
      contactPerson,
      phone,
      email,
      website,
      note,
      verificationStatus: status,
    });
    return NextResponse.json({ success: true, contact });
  } catch (error) {
    return jsonError('DATABASE_ERROR', 'Kontaktní údaje se nepodařilo uložit.', 500);
  }
}
