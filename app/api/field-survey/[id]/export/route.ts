import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurvey, listFieldSurveyPoints } from '@/lib/field-survey/data';
import { exportFieldSurveyXlsx, exportFieldSurveyGeoJson, exportFieldSurveyKml } from '@/lib/field-survey/export';
import type { FieldSurveyPointStatus, FieldSurveySurfaceType } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * GET /api/field-survey/[id]/export?format=csv|xlsx|geojson|kml
 *
 * Export průzkumné akce. Respektuje aktivní filtry z URL params.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;

  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 400 });
  }
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const survey = await getFieldSurvey(surveyId);
  if (!survey) {
    return NextResponse.json({ error: 'Průzkumná akce nebyla nalezena.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'geojson').toLowerCase();
  const status = url.searchParams.get('status') ?? undefined;
  const surfaceType = url.searchParams.get('surfaceType') ?? undefined;
  const createdByUserId = url.searchParams.get('createdByUserId') ?? undefined;
  const hasParcel = url.searchParams.has('hasParcel') ? url.searchParams.get('hasParcel') === 'true' : undefined;
  const hasContact = url.searchParams.has('hasContact') ? url.searchParams.get('hasContact') === 'true' : undefined;

  const points = await listFieldSurveyPoints({
    surveyId,
    status: status as FieldSurveyPointStatus,
    surfaceType: surfaceType as FieldSurveySurfaceType,
    createdByUserId,
    hasParcel,
    hasContact,
  });

  const safeName = survey.name.replace(/[^a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s_-]/g, '').trim();
  const dateStr = new Date().toISOString().slice(0, 10);

  console.info('[field-survey] Export', { surveyId, format, count: points.length, orgId: organizationId, userId: auth.id });

  if (format === 'geojson') {
    const geojson = exportFieldSurveyGeoJson(points as Parameters<typeof exportFieldSurveyGeoJson>[0], survey.name);
    return new Response(geojson, {
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="pruzkum-${safeName}-${dateStr}.geojson"`,
      },
    });
  }

  if (format === 'kml') {
    const kml = exportFieldSurveyKml(points as Parameters<typeof exportFieldSurveyKml>[0], survey.name);
    return new Response(kml, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="pruzkum-${safeName}-${dateStr}.kml"`,
      },
    });
  }

  if (format === 'xlsx' || format === 'csv') {
    const buffer = await exportFieldSurveyXlsx(points as Parameters<typeof exportFieldSurveyXlsx>[0], survey.name);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pruzkum-${safeName}-${dateStr}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: `Nepodporovaný formát exportu: ${format}. Podporované formáty: geojson, kml, xlsx, csv.` }, { status: 400 });
}
