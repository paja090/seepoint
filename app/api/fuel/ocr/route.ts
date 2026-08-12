import { getCurrentUser } from '@/lib/auth';
import { parseFuelReceiptWithGemini } from '@/lib/ai-gemini';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    imageUrl: string;
  } | null;

  if (!body || !body.imageUrl) {
    return NextResponse.json({ error: 'Chybí fotka účtenky.' }, { status: 400 });
  }

  try {
    const ocrData = await parseFuelReceiptWithGemini(body.imageUrl);
    return NextResponse.json({
      ok: true,
      data: ocrData,
      message: `✨ AI úspěšně přečetla účtenku (${ocrData.vendor}: ${ocrData.amountCzk} Kč / ${ocrData.liters} L)!`,
    });
  } catch (err: unknown) {
    console.error('Fuel OCR error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Nepodařilo se přečíst účtenku.' },
      { status: 500 }
    );
  }
}
