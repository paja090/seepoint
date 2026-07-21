import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { extractFromPhotoList } from '@/lib/navigation-photo-ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const surface = await prisma.advertisingSurface.findUnique({
      where: { id },
      include: {
        carrier: {
          include: {
            photos: true,
          },
        },
      },
    });

    if (!surface) {
      return NextResponse.json({ error: 'Navigační pozice nebyla nalezena.' }, { status: 404 });
    }

    const photos = surface.carrier.photos.map((p) => ({
      url: p.url,
      note: p.note ?? undefined,
      filename: p.url.split('/').pop(),
    }));

    const result = extractFromPhotoList(photos);

    if (!result) {
      return NextResponse.json({
        found: false,
        message: 'Z fotek nosiče se nepodařilo automaticky rozpoznat směr ani vzdálenost.',
      });
    }

    return NextResponse.json({
      found: true,
      extracted: result,
    });
  } catch (err) {
    console.error('Extraction error:', err);
    return NextResponse.json({ error: 'Chyba při rozpoznávání fotek.' }, { status: 500 });
  }
}
