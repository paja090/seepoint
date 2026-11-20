import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { offerErrorResponse } from '@/lib/offers/http';
import { getOffer } from '@/lib/offers/service';
import { buildNavigationAgencyExportZip } from '@/lib/offers/navigation-agency-export';
import type { OfferView } from '@/lib/offers/view-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;
  enterTenantContext({
    organizationId: auth.organizationId!,
    userId: auth.id,
    source: 'session',
  });

  try {
    const { id } = await params;
    const offer = (await getOffer(auth, id)) as OfferView;

    if (offer.offerType !== 'NAVIGATION' || !offer.navigation?.points?.length) {
      return NextResponse.json(
        { error: 'Export navigačního balíčku je dostupný pouze pro navigační nabídky s alespoň jedním bodem.' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const includePricesParam = url.searchParams.get('includePrices');
    const includePrices =
      includePricesParam === '1' || includePricesParam === 'true'
        ? true
        : includePricesParam === '0' || includePricesParam === 'false'
          ? false
          : undefined;
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
    return offerErrorResponse(error);
  }
}
