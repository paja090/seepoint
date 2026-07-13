import { AppShell } from '@/components/AppShell';
import { OfferWizard } from '@/components/offers/OfferWizard';
import { PageHeader } from '@/components/ui';
import { requirePageAccess } from '@/lib/page-auth';
import { getOfferFormOptions } from '@/lib/offers/form-options';

export const dynamic = 'force-dynamic';
export default async function NewOfferPage() { await requirePageAccess('offers'); const options = await getOfferFormOptions(); return <AppShell><PageHeader title="Nová reklamní nabídka" description="Jeden sjednocený campaign wizard pro klienta, termíny, více ploch, kalkulaci, dostupnost a profesionální náhled." /><OfferWizard {...options} /></AppShell>; }
