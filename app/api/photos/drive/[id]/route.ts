import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  try {
    const driveFileId = (await params).id;
    if (!driveFileId) {
      return NextResponse.json({ error: 'Chybí ID souboru.' }, { status: 400 });
    }

    const file = await downloadPhotoFromGoogleDrive(driveFileId);
    if (!file.ok || !file.body) {
      return NextResponse.json(
        { error: 'Fotografii se nepodařilo načíst z Google Disku.' },
        { status: file.status === 404 ? 404 : 502 }
      );
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        'Content-Type': file.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Google Drive photo fetch error:', error);
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Google Drive úložiště není nakonfigurované.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Chyba při načítání fotografie.' }, { status: 502 });
  }
}
