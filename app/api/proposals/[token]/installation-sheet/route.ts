import { NextResponse } from 'next/server';
import { OfferValidationError } from '@/lib/offers/domain';
import { createInstallationSheetPdf } from '@/lib/offers/pdf';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getPublicOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { canDownloadInstallationSheet } from '@/lib/offers/navigation-document-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filename = (title: string) => `montazni-list-${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'seepoint'}.pdf`;

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  try {
    const offerView = await getPublicOffer(token) as OfferView;
    if (!canDownloadInstallationSheet(offerView)) {
      return NextResponse.json(
        { error: 'Montážní list bude dostupný až po přijetí cenové nabídky klientem.' },
        { status: 409 },
      );
    }
    const offer = toProposalOffer(offerView);
    const pdf = await createInstallationSheetPdf(offer);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename(offer.title))}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    }
    console.error('Installation sheet PDF generation failed', error);
    return NextResponse.json({ error: 'Montážní list se nepodařilo vytvořit.' }, { status: 500 });
  }
}
