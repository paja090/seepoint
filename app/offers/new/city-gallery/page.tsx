import { AppShell } from '@/components/AppShell';
import { CityGalleryOfferForm } from '@/components/offers/CityGalleryOfferForm';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NewCityGalleryOfferPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  await requirePageAccess('offers');
  const [options, params] = await Promise.all([getSpecializedOfferOptions(), searchParams]);
  const initialProjectId = options.projects.some((project) => project.id === params.projectId) ? params.projectId : undefined;
  return <AppShell><CityGalleryOfferForm {...options} initialProjectId={initialProjectId} /> </AppShell>;
}
