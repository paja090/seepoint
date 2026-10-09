import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canReviewAcademy } from '@/lib/academy/review-policy';
import media from '@/lib/academy/review-media.json';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const actor = await getCurrentUser();
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!canReviewAcademy(actor)) return NextResponse.json({ error: 'Nedostupné.' }, { status: 404, headers });
  const { file } = await params;
  if (!Object.hasOwn(media, file)) return NextResponse.json({ error: 'Nenalezeno.' }, { status: 404, headers });
  return new Response(Buffer.from(media[file as keyof typeof media], 'base64'), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
}
