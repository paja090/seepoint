import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { listImagesInFolderPage, GoogleDriveConfigurationError, isGoogleDriveMockEnabled } from '@/lib/google-drive';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) return NextResponse.json({ error: 'Aktivní organizace není vybraná.' }, { status: 403 });

  return runWithTenantContext(
    { organizationId: auth.organizationId, userId: auth.id, source: 'session' },
    async () => {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const mockEnabled = isGoogleDriveMockEnabled();

      if (!folderId && !mockEnabled) {
        return NextResponse.json(
          { error: 'Chybí konfigurace GOOGLE_DRIVE_FOLDER_ID a mock režim není povolen.' },
          { status: 500 }
        );
      }

      try {
        const url = new URL(request.url);
        const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
        const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 100;
        const pageToken = url.searchParams.get('pageToken')?.trim() || undefined;
        const page = await listImagesInFolderPage(folderId || 'mock-folder-id', { pageSize: limit, pageToken });
        return NextResponse.json(page);
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
    },
  );
}
