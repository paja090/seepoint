import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { respondToPublicOffer } from '@/lib/offers/service';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) { try { const token = (await params).token; const limited = await enforceRateLimit(request, hashRateLimitIdentity(token), rateLimitPolicies.publicOfferResponse); if (limited) return limited; return NextResponse.json(await respondToPublicOffer(token, await request.json())); } catch (error) { return offerErrorResponse(error); } }
