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
      },
    });

    if (!report || report.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    if (report.tokenExpiresAt && new Date() > report.tokenExpiresAt) {
      return NextResponse.json({ error: 'Platnost odkazu vypršela.' }, { status: 410 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        content: true,
        driveFileId: true,
        url: true,
        fileName: true,
        mimeType: true,
        isClientVisible: true,
        isPrivate: true,
      },
    });

    if (!photo || photo.isPrivate || photo.isClientVisible === false) {
      return NextResponse.json({ error: 'Fotografie není dostupná.' }, { status: 404 });
    }

    // 1. Direct Binary Content in Database
    if (photo.content && photo.content.length > 0) {
      return new Response(photo.content, {
        status: 200,
        headers: {
          'Content-Type': photo.mimeType ?? 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 2. Base64 Data URI in photo.url
    if (photo.url && photo.url.startsWith('data:')) {
      const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400, immutable',
          },
        });
      }
    }

    // 3. Google Drive Storage
    if (photo.driveFileId) {
      const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (file.ok && file.body) {
        return new Response(file.body, {
          status: 200,
          headers: {
            'Content-Type': photo.mimeType ?? file.headers.get('Content-Type') ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    // 4. External HTTP URL
    if (photo.url && photo.url.startsWith('http') && !photo.url.includes('/api/photos/')) {
      return NextResponse.redirect(photo.url);
    }

    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 404 });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 500 });
  }
}
