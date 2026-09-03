import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { canReadPhoto } from '@/lib/photo-access';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  try {
    const { id } = await params;
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        storageKey: true,
        storageProvider: true,
        content: true,
        fileName: true,
        mimeType: true,
        employeeId: true,
        type: true,
        workEntryId: true,
        isPrivate: true,
        carrierId: true,
        surfaceId: true,
        siteNavigationPoint: {
          select: {
            navigationOffer: {
              select: {
                offer: {
                  select: { createdByUserId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url)) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    if (!await canReadPhoto(user, photo)) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const stored = await readStoredPhoto(photo);
    if (!stored) return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    if (stored.redirectUrl) return new Response(null, { status: 307, headers: {
      Location: stored.redirectUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    } });
    return new Response(stored.body, { status: 200, headers: {
      'Content-Type': stored.contentType ?? photo.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    console.error('Photo download failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
