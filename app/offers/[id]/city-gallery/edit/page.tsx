import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CityGalleryOfferForm } from '@/components/offers/CityGalleryOfferForm';
import { getOffer } from '@/lib/offers/service';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function EditCityGalleryOfferPage({ params }: { params: Promise<{ id: string }> }) { const user = await requirePageAccess('offers'); const id = (await params).id; const [offer, options] = await Promise.all([getOffer(user, id) as Promise<OfferView>, getSpecializedOfferOptions()]); if (offer.offerType !== 'CITY_GALLERY' || offer.status !== 'DRAFT') notFound(); return <AppShell><CityGalleryOfferForm {...options} initialOffer={offer} /></AppShell>; }
