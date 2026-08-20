import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { MobileSurveyFieldView } from '@/components/navigation/MobileSurveyFieldView';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function MobileSurveyDetailPage({ params }: { params: Params }) {
  await requirePageAccess('navigationProjects');
  const { id } = await params;

  return (
    <AppShell>
      <MobileSurveyFieldView orderId={id} />
    </AppShell>
  );
}
