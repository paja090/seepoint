import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { offerErrorResponse } from '@/lib/offers/http';
import { buildCommercialOfferDraft } from '@/lib/ai-commercial/offer-builder';
import type { OfferDraftInput } from '@/lib/ai-commercial/contracts/offer-draft';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const rawBody = (await request.json().catch(() => ({}))) as Partial<OfferDraftInput>;

    const input: OfferDraftInput = {
      ...rawBody,
      organizationId: auth.organizationId!,
      selectedSurfaceIds: Array.isArray(rawBody.selectedSurfaceIds)
        ? rawBody.selectedSurfaceIds
        : undefined,
      dateFrom: rawBody.dateFrom ? new Date(rawBody.dateFrom) : undefined,
      dateTo: rawBody.dateTo ? new Date(rawBody.dateTo) : undefined,
    };

    const result = await buildCommercialOfferDraft(input, auth);
    return NextResponse.json(result);
  } catch (error) {
    return offerErrorResponse(error);
  }
}
