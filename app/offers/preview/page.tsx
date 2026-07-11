import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { Button, PageHeader } from '@/components/ui';
import { mockOffer } from '@/lib/mock-offer-data';

export const metadata = {
  title: 'Náhled nabídky | SeePOINT',
};

export default function OfferPreviewPage() {
  const publicUrl = `/offer/${mockOffer.publicToken}`;

  return (
    <AppShell>
      <PageHeader
        title="Náhled klientské nabídky"
        description="Takto uvidí nabídku klient po odeslání odkazem. Ukázková data pro šablonu prezentace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href="/offers" variant="ghost">
              <ArrowLeft aria-hidden className="mr-1.5" size={16} />
              Zpět na nabídky
            </Button>
            <Button href={publicUrl} variant="secondary">
              <ExternalLink aria-hidden className="mr-1.5" size={16} />
              Otevřít klientský odkaz
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
        <Info aria-hidden className="mt-0.5 shrink-0" size={18} />
        <p className="leading-6">
          Toto je pouze náhled šablony s ilustračními daty. Ceny, statistiky, reference i loga jsou ukázkové a v
          produkční verzi se načtou z reálné nabídky.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <OfferProposal offer={mockOffer} variant="internal" />
      </div>
    </AppShell>
  );
}
