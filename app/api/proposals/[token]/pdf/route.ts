import { NextResponse } from 'next/server';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';
import { OfferValidationError } from '@/lib/offers/domain';
import { createOfferPdf } from '@/lib/offers/pdf';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getPublicClientLogo, getPublicOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filename = (title: string) => `${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'nabidka'}.pdf`;

async function loadClientLogo(token: string): Promise<string | undefined> {
  try {
    const logo = await getPublicClientLogo(token);
    if (!['image/png', 'image/jpeg'].includes(logo.mimeType ?? '')) return undefined;
    const file = await downloadPhotoFromGoogleDrive(logo.driveFileId);
    if (!file.ok) return undefined;
    const bytes = await new Response(file.body).arrayBuffer();
    return `data:${logo.mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  try {
    const offer = toProposalOffer(await getPublicOffer(token) as OfferView);
    const pdf = await createOfferPdf(offer, await loadClientLogo(token));
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename(offer.title))}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') return NextResponse.json({ error: 'Nabídka nebyla nalezena.' }, { status: 404 });
    console.error('Offer PDF generation failed', error);
    return NextResponse.json({ error: 'PDF nabídky se nepodařilo vytvořit.' }, { status: 500 });
  }
}
