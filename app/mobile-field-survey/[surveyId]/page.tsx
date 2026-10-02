import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { getFieldSurvey } from '@/lib/field-survey/data';
import { MobileFieldSurveyView } from '@/components/field-survey/MobileFieldSurveyView';

export const dynamic = 'force-dynamic';

export default async function MobileFieldSurveyPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  const user = await requirePageAccess('fieldSurvey');

  if (user.organizationId) {
    enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });
  }

  const survey = await getFieldSurvey(surveyId);
  if (!survey) notFound();

  return (
    <MobileFieldSurveyView
      surveyId={survey.id}
      surveyName={survey.name}
    />
  );
}
