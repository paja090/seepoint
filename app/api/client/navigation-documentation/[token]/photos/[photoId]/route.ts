import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/navigation-documentation';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  try {
    const { token, photoId } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    const report = await prisma.navigationDocumentationReport.findUnique({
      where: { publicTokenHash: tokenHash },
      select: {
        status: true,
        tokenExpiresAt: true,
        items: {
          where: { isVisible: true },
          select: {
            selectedPhotoId: true,
            carrier: {
              select: {
                photos: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!report || report.status === 'ARCHIVED' || report.status === 'DRAFT') {
      return NextResponse.json({ error: 'Report nebyl nalezen nebo není publikován.' }, { status: 404 });
    }

    if (report.tokenExpiresAt && new Date() > report.tokenExpiresAt) {
      return NextResponse.json({ error: 'Platnost odkazu vypršela.' }, { status: 410 });
    }

    // Verify photo belongs to report items
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { driveFileId: true, fileName: true, mimeType: true, isClientVisible: true, isPrivate: true },
    });

    if (!photo || photo.isPrivate || photo.isClientVisible === false) {
      return NextResponse.json({ error: 'Fotografie není dostupná.' }, { status: 404 });
    }

    if (!photo.driveFileId) {
      return NextResponse.json({ error: 'Fotografie nemá připojené úložiště.' }, { status: 404 });
    }

    const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
    if (!file.ok || !file.body) {
      return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: file.status === 404 ? 404 : 502 });
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType ?? file.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 500 });
  }
}
