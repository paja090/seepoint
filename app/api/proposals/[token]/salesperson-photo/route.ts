import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';
import { getPublicRow } from '@/lib/offers/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const offer = await getPublicRow((await params).token);
    if (!offer.createdByUserId) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    const photo = await prisma.photo.findFirst({
      where: {
        type: 'EMPLOYEE_PROFILE',
        isPrivate: false,
        employee: { userId: offer.createdByUserId, isActive: true },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      select: { driveFileId: true, mimeType: true },
    });
    if (!photo?.driveFileId) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
    if (!file.ok || !file.body) return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: file.status === 404 ? 404 : 502 });
    return new Response(file.body, {
      headers: {
        'Content-Type': photo.mimeType || file.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 503 });
    return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
  }
}
