import { NextResponse } from 'next/server';
import { OfferValidationError } from '@/lib/offers/domain';
import { getPublicOffer } from '@/lib/offers/service';
import { buildNavigationAgencyExportZip } from '@/lib/offers/navigation-agency-export';
import type { OfferView } from '@/lib/offers/view-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const offer = (await getPublicOffer(token)) as OfferView;

    if (offer.offerType !== 'NAVIGATION' || !offer.navigation?.points?.length) {
      return NextResponse.json(
        { error: 'Export navigačního balíčku je dostupný pouze pro navigační nabídky s alespoň jedním bodem.' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const isConceptOrSelection =
      Boolean(offer.isNoPriceConcept) || offer.navigation.proposalMode !== 'PRICED_QUOTE';
    const rawIncludePrices = url.searchParams.get('includePrices');
    const includePrices = isConceptOrSelection
      ? false
      : rawIncludePrices === '0' || rawIncludePrices === 'false'
        ? false
        : true;

    const selectedOnly =
      url.searchParams.get('selectedOnly') === '1' ||
      url.searchParams.get('selectedOnly') === 'true';
    const rawPointIds = url.searchParams.get('pointIds');
    const pointIds = rawPointIds
      ? rawPointIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    const result = await buildNavigationAgencyExportZip(offer, {
      includePrices,
      selectedOnly,
      pointIds,
    });

    return new Response(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': String(result.zipBuffer.length),
      },
    });
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    }
    console.error('[proposals/navigation-export-zip] Export failed:', error);
    return NextResponse.json(
      {
        error: 'Export balíčku pro agenturu se nepodařilo vytvořit.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
