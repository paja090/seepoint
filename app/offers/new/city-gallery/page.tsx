import { AppShell } from '@/components/AppShell';
import { CityGalleryOfferForm } from '@/components/offers/CityGalleryOfferForm';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NewCityGalleryOfferPage() {
  await requirePageAccess('offers');
  const options = await getSpecializedOfferOptions();
  return <AppShell><CityGalleryOfferForm {...options} /> </AppShell>;
}
