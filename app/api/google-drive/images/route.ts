import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { listImagesInFolder, GoogleDriveConfigurationError, isGoogleDriveMockEnabled } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const mockEnabled = isGoogleDriveMockEnabled();

  if (!folderId && !mockEnabled) {
    return NextResponse.json(
      { error: 'Chybí konfigurace GOOGLE_DRIVE_FOLDER_ID a mock režim není povolen.' },
      { status: 500 }
    );
  }

  try {
    const files = await listImagesInFolder(folderId || 'mock-folder-id');
    return NextResponse.json(files);
  } catch (error) {
    console.error('Failed to list Google Drive images:', error);
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json(
        { error: 'Google Drive úložiště zatím není nakonfigurované.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Nepodařilo se načíst seznam souborů z Google Drive.' },
      { status: 502 }
    );
  }
}
