import type { Metadata } from 'next';
import { PublicInventoryCatalogView } from '@/components/client-catalog/PublicInventoryCatalogView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Katalog reklamních ploch & Konfigurátor kampaně | SeePOINT',
  description:
    'Prohlédněte si volné reklamní nosiče, ceníkové ceny a sestavte si vlastní kampaň online s okamžitou kalkulací a nezávaznou rezervací.',
};

export default function ClientCatalogPage() {
  return <PublicInventoryCatalogView />;
}
