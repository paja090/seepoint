import { NextResponse } from 'next/server';
import { OfferValidationError } from '@/lib/offers/domain';
import { getPublicClientLogo } from '@/lib/offers/service';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const logo = await getPublicClientLogo((await params).token);
    return new Response(new Uint8Array(logo.buffer), {
      headers: {
        'Content-Type': logo.mimeType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(logo.fileName)}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') return NextResponse.json({ error: 'Logo nebylo nalezeno.' }, { status: 404 });
    return NextResponse.json({ error: 'Logo se nepodařilo načíst.' }, { status: 502 });
  }
}
