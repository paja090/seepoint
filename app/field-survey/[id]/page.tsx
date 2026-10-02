import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurvey, listFieldSurveyPoints } from '@/lib/field-survey/data';
import { FieldSurveyWorkspace } from '@/components/field-survey/FieldSurveyWorkspace';

export const dynamic = 'force-dynamic';

export default async function FieldSurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageAccess('fieldSurvey');

  if (user.organizationId) {
    enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });
  }

  const survey = await getFieldSurvey(id);
  if (!survey) notFound();

  const points = await listFieldSurveyPoints({ surveyId: id });

  // Map to the format expected by the client workspace
  const serializedPoints = points.map((p) => ({
    id: p.id,
    surveyId: p.surveyId,
    surfaceType: p.surfaceType,
    status: p.status,
    latitude: p.latitude,
    longitude: p.longitude,
    gpsAccuracyMeters: p.gpsAccuracyMeters,
    address: p.address,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    createdBy: { name: p.createdBy.name },
    photos: p.photos.map((ph) => ({
      id: ph.id,
      url: ph.url,
      sortOrder: ph.sortOrder,
    })),
    parcelData: p.parcelData ? {
      parcelNumber: p.parcelData.parcelNumber,
      cadastralArea: p.parcelData.cadastralArea,
      municipality: p.parcelData.municipality,
      confidence: p.parcelData.confidence,
    } : null,
    ownerData: p.ownerData ? {
      ownerName: p.ownerData.ownerName,
      ownerType: p.ownerData.ownerType,
    } : null,
    contactData: p.contactData ? {
      company: p.contactData.company,
      contactPerson: p.contactData.contactPerson,
      phone: p.contactData.phone,
      email: p.contactData.email,
    } : null,
    aiAnalysis: p.aiAnalysis ? {
      status: p.aiAnalysis.status,
      suggestedType: p.aiAnalysis.suggestedType,
      isUsable: p.aiAnalysis.isUsable,
      confirmedAt: p.aiAnalysis.confirmedAt?.toISOString() ?? null,
    } : null,
  }));

  return (
    <AppShell>
      <FieldSurveyWorkspace
        survey={{
          id: survey.id,
          name: survey.name,
          description: survey.description,
          status: survey.status,
        }}
        initialPoints={serializedPoints}
        userRole={user.role}
      />
    </AppShell>
  );
}
