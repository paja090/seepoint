import { parseFuelReceiptWithGemini } from '@/lib/ai-gemini';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { validateChatImage } from '@/lib/chat-policy';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${user.organizationId}:${user.id}`), rateLimitPolicies.fuelOcr);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as {
    imageUrl: string;
  } | null;

  if (!body || !body.imageUrl) {
    return NextResponse.json({ error: 'Chybí fotka účtenky.' }, { status: 400 });
  }
  const image = validateChatImage(body.imageUrl);
  if ('error' in image) return NextResponse.json({ error: image.error }, { status: 400 });

  try {
    const ocrData = await parseFuelReceiptWithGemini(image.value!);
    return NextResponse.json({
      ok: true,
      data: ocrData,
      message: `✨ AI úspěšně přečetla účtenku (${ocrData.vendor}: ${ocrData.amountCzk} Kč / ${ocrData.liters} L)!`,
    });
  } catch (err: unknown) {
    console.error('Fuel OCR error:', err);
    return NextResponse.json({ error: 'Účtenku se nepodařilo bezpečně přečíst. Údaje můžete zadat ručně.' }, { status: 502 });
  }
}
