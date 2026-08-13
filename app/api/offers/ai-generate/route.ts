import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { handleAiOffer } from '@/lib/ai-offers/service';
import { offerErrorResponse } from '@/lib/offers/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireApiAccess('offers');
  if (isApiDenied(user)) return user;
  try {
    return NextResponse.json(await handleAiOffer(user, await request.json()));
  } catch (error) {
    return offerErrorResponse(error, 'AI offer orchestration failed');
  }
}
